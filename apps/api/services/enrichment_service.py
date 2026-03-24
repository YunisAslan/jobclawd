"""
Enrichment service — extract metadata from job detail pages.

Strategy (fast path):
  1. httpx fetch ALL detail pages in parallel (fast, ~3s for 50 URLs)
  2. Regex extraction on fetched HTML
  3. AI batch extraction for jobs still missing fields
  4. Browser fallback only for URLs where httpx got nothing

This gives ~80%+ metadata coverage vs. the old browser-only approach.
"""

import asyncio
import re
from html import unescape
from typing import Optional

import httpx

from repositories.metadata_repo import get_metadata_batch, upsert_metadata
from services.ai_metadata_extractor import extract_metadata_ai_batch
from utils.job_meta_extractor import extract_all

# ── Config ──────────────────────────────────────────────────────────
_CONCURRENCY_HTTP = 12
_CONCURRENCY_BROWSER = 5
_TIMEOUT_HTTP = 12.0
_TIMEOUT_BROWSER = 12000  # ms for Playwright
_BROWSER_FALLBACK_LIMIT = 20  # max URLs to fall back to browser
_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


def _should_skip_detail_enrichment(url: str) -> bool:
    # jobsearch.az already has structured API fields + AI extraction in scraper.
    # Fetching their detail pages is redundant and slow.
    lowered = (url or "").lower()
    return "jobsearch.az" in lowered

# ── HTML helpers ────────────────────────────────────────────────────
_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")

# Patterns to extract job description from HTML
_DESC_PATTERNS = [
    # Indeed viewjob
    re.compile(r'<div[^>]*id="jobDescriptionText"[^>]*>(.*?)</div>', re.S | re.I),
    # Indeed salary+type header
    re.compile(r'<div[^>]*id="salaryInfoAndJobType"[^>]*>(.*?)</div>', re.S | re.I),
    # LinkedIn public page
    re.compile(r'<div[^>]*class="[^"]*show-more-less-html__markup[^"]*"[^>]*>(.*?)</div>', re.S | re.I),
    # LinkedIn criteria list
    re.compile(r'<ul[^>]*class="[^"]*description__job-criteria-list[^"]*"[^>]*>(.*?)</ul>', re.S | re.I),
    # LinkedIn description section
    re.compile(r'<section[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)</section>', re.S | re.I),
    # jobsearch.az
    re.compile(r'<div[^>]*class="[^"]*content-text[^"]*"[^>]*>(.*?)</div>', re.S | re.I),
    # Generic
    re.compile(r'<div[^>]*class="[^"]*job[-_]?desc[^"]*"[^>]*>(.*?)</div>', re.S | re.I),
]

# Extra patterns to grab metadata sections (Indeed/LinkedIn sidebar info)
_META_SECTION_PATTERNS = [
    # Indeed job details sections
    re.compile(r'<div[^>]*class="[^"]*jobsearch-JobDescriptionSection[^"]*"[^>]*>(.*?)</div>', re.S | re.I),
    re.compile(r'<div[^>]*class="[^"]*jobsearch-OtherJobDetailsContainer[^"]*"[^>]*>(.*?)</div>', re.S | re.I),
    # Indeed job component sections
    re.compile(r'<div[^>]*id="jobDetailsSection"[^>]*>(.*?)</div>', re.S | re.I),
    # LinkedIn criteria items
    re.compile(r'<li[^>]*class="[^"]*description__job-criteria-item[^"]*"[^>]*>(.*?)</li>', re.S | re.I),
    # LinkedIn top card insights
    re.compile(r'<li[^>]*class="[^"]*jobs-unified-top-card__job-insight[^"]*"[^>]*>(.*?)</li>', re.S | re.I),
]


def _html_to_text(html: str) -> str:
    """Rough HTML → plain text."""
    text = re.sub(r"</(p|div|li|br|h\d|tr)", r" </\1", html)
    text = _TAG_RE.sub(" ", text)
    text = unescape(text)
    text = _WS_RE.sub(" ", text)
    return text.strip()


def _extract_all_text(html: str) -> str:
    """Extract as much job-relevant text as possible from HTML."""
    parts: list[str] = []

    # Primary description
    for pat in _DESC_PATTERNS:
        for m in pat.finditer(html):
            text = _html_to_text(m.group(1))
            if len(text) > 30:
                parts.append(text)

    # Metadata sections
    for pat in _META_SECTION_PATTERNS:
        for m in pat.finditer(html):
            text = _html_to_text(m.group(1))
            if len(text) > 10:
                parts.append(text)

    if parts:
        combined = " | ".join(parts)
        return combined[:8000]

    # Fallback: entire body
    body_match = re.search(r"<body[^>]*>(.*)</body>", html, re.S | re.I)
    if body_match:
        return _html_to_text(body_match.group(1))[:5000]

    return _html_to_text(html)[:5000]


def _extract_title_from_html(html: str) -> str:
    """Extract job title from HTML page."""
    # Indeed
    m = re.search(r'<h1[^>]*class="[^"]*jobsearch-JobInfoHeader-title[^"]*"[^>]*>(.*?)</h1>', html, re.S | re.I)
    if m:
        return _html_to_text(m.group(1))[:200]
    # LinkedIn
    m = re.search(r'<h1[^>]*class="[^"]*top-card-layout__title[^"]*"[^>]*>(.*?)</h1>', html, re.S | re.I)
    if m:
        return _html_to_text(m.group(1))[:200]
    # Generic h1
    m = re.search(r'<h1[^>]*>(.*?)</h1>', html, re.S | re.I)
    if m:
        return _html_to_text(m.group(1))[:200]
    return ""


def _compact_for_ai(text: str, *, max_len: int = 3000) -> str:
    """Keep text within token budget. Head + tail strategy."""
    cleaned = (text or "").strip()
    if len(cleaned) <= max_len:
        return cleaned
    head = max_len * 2 // 3
    tail = max_len - head - 5
    return f"{cleaned[:head].strip()} ... {cleaned[-tail:].strip()}"


def _has_complete_meta(meta: Optional[dict]) -> bool:
    if not meta:
        return False
    return all(
        meta.get(field)
        for field in ("experience_str", "job_type_str", "salary_str", "work_mode_str")
    )


def _merge_missing_fields(base: Optional[dict], extra: Optional[dict]) -> dict:
    merged = dict(base or {})
    pairs = [
        ("experience_str", "experience_src"),
        ("job_type_str", "job_type_src"),
        ("salary_str", "salary_src"),
        ("work_mode_str", "work_mode_src"),
        ("apply_method_str", "apply_method_src"),
    ]
    for value_field, source_field in pairs:
        if not merged.get(value_field) and extra and extra.get(value_field):
            merged[value_field] = extra[value_field]
            if extra.get(source_field):
                merged[source_field] = extra[source_field]
        elif not merged.get(source_field) and extra and extra.get(source_field) and merged.get(value_field):
            merged[source_field] = extra[source_field]
    # Merge extra metadata fields
    for extra_field in ("skills_str", "languages_str", "work_auth_str",
                        "parse_confidence", "apply_complexity", "auto_apply_support"):
        if not merged.get(extra_field) and extra and extra.get(extra_field):
            merged[extra_field] = extra[extra_field]
    return merged


def _regex_salary_only(meta: Optional[dict]) -> dict:
    if not meta or not meta.get("salary_str"):
        return {}
    return {
        "salary_str": meta["salary_str"],
        "salary_src": "regex",
    }


def _drop_low_trust_regex_fields(job: dict) -> None:
    for value_field, source_field in (
        ("experience_str", "experience_src"),
        ("job_type_str", "job_type_src"),
        ("work_mode_str", "work_mode_src"),
    ):
        if job.get(source_field) == "regex":
            job.pop(value_field, None)
            job.pop(source_field, None)


def _apply_metadata_to_job(job: dict, meta: dict, *, overwrite_non_structured: bool = False) -> None:
    pairs = [
        ("experience_str", "experience_src"),
        ("job_type_str", "job_type_src"),
        ("salary_str", "salary_src"),
        ("work_mode_str", "work_mode_src"),
        ("apply_method_str", "apply_method_src"),
    ]
    for value_field, source_field in pairs:
        incoming_value = meta.get(value_field)
        incoming_source = meta.get(source_field)
        current_value = job.get(value_field)
        current_source = (job.get(source_field) or "").strip().lower()

        should_replace = not current_value
        if overwrite_non_structured and incoming_value and current_value:
            should_replace = current_source not in {"structured"}

        if incoming_value and should_replace:
            job[value_field] = incoming_value
            if incoming_source:
                job[source_field] = incoming_source
        elif incoming_source and not job.get(source_field) and job.get(value_field):
            job[source_field] = incoming_source

    # Map apply_method_str → apply_method (JobListing uses "apply_method" not "apply_method_str")
    if meta.get("apply_method_str") and not job.get("apply_method"):
        job["apply_method"] = meta["apply_method_str"]
    if meta.get("apply_method_src") and not job.get("apply_method_src"):
        job["apply_method_src"] = meta["apply_method_src"]

    # Copy extra metadata fields (non-overwrite)
    for extra_field in ("skills_str", "languages_str", "work_auth_str",
                        "parse_confidence", "apply_complexity", "auto_apply_support"):
        if not job.get(extra_field) and meta.get(extra_field):
            job[extra_field] = meta[extra_field]


# ── httpx fetcher ───────────────────────────────────────────────────

async def _fetch_page_text(client: httpx.AsyncClient, url: str) -> tuple[str, str, str]:
    """
    Fetch a page via httpx and extract text.
    Returns (url, title, extracted_text). Empty text on failure.
    """
    try:
        resp = await client.get(url, follow_redirects=True, timeout=_TIMEOUT_HTTP)
        if resp.status_code != 200:
            return url, "", ""
        # Detect login/auth redirects (LinkedIn gates bots to login page)
        final_url = str(resp.url)
        if any(kw in final_url for kw in ("/login", "/authwall", "/checkpoint", "/signup", "/uas/")):
            return url, "", ""
        html = resp.text
        if len(html) < 500:
            return url, "", ""
        title = _extract_title_from_html(html)
        text = _extract_all_text(html)
        return url, title, text
    except Exception:
        return url, "", ""


# ── Playwright fetcher (fallback) ──────────────────────────────────

async def _fetch_browser_batch(urls: list[str]) -> dict[str, tuple[str, str]]:
    """
    Fetch pages via Playwright browser (fallback for httpx failures).
    Returns {url: (title, extracted_text)}.
    """
    from scraper import get_browser

    results: dict[str, tuple[str, str]] = {}
    if not urls:
        return results

    browser = await get_browser()
    sem = asyncio.Semaphore(_CONCURRENCY_BROWSER)

    async def _fetch_one(url: str):
        context = None
        try:
            async with sem:
                context = await browser.new_context(
                    user_agent=_UA,
                    viewport={"width": 1280, "height": 720},
                )
                await context.route(
                    "**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,otf,css}",
                    lambda route: route.abort(),
                )
                page = await context.new_page()
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=_TIMEOUT_BROWSER)
                    await page.wait_for_timeout(1500)
                except Exception:
                    results[url] = ("", "")
                    return

                payload = await page.evaluate("""
                    () => {
                        const cleanText = (v) => (v || '').replace(/\\s+/g, ' ').trim();
                        const collect = (sels) => {
                            const r = [];
                            for (const s of sels) {
                                for (const el of document.querySelectorAll(s)) {
                                    const t = cleanText(el.innerText || el.textContent);
                                    if (t) r.push(t);
                                }
                            }
                            return r;
                        };

                        const title = cleanText(
                            document.querySelector('h1')?.innerText
                        );

                        let desc = '';
                        // Indeed
                        let el = document.getElementById('jobDescriptionText');
                        if (el?.innerText?.trim().length > 50) desc = el.innerText.trim();
                        // LinkedIn
                        if (!desc) {
                            for (const s of ['.show-more-less-html__markup', '.description__text', '.jobs-description__content']) {
                                el = document.querySelector(s);
                                if (el?.innerText?.trim().length > 50) { desc = el.innerText.trim(); break; }
                            }
                        }
                        // Generic
                        if (!desc) {
                            for (const s of ['.job-description', '[class*="description"]', 'article']) {
                                el = document.querySelector(s);
                                if (el?.innerText?.trim().length > 100) { desc = el.innerText.trim(); break; }
                            }
                        }

                        const meta = collect([
                            '#salaryInfoAndJobType',
                            '.description__job-criteria-list',
                            '.description__job-criteria-item',
                            '.jobs-unified-top-card__job-insight',
                            '.jobsearch-JobDescriptionSection-sectionItem',
                            '.jobsearch-OtherJobDetailsContainer *',
                        ]);

                        return { title, desc, meta: meta.join(' | ') };
                    }
                """)

                title = payload.get("title", "")
                text_parts = [
                    payload.get("meta", ""),
                    payload.get("desc", ""),
                ]
                text = " | ".join(p for p in text_parts if p).strip()
                results[url] = (title, text[:8000])

        except Exception as e:
            print(f"[Enrichment] Browser error for {url}: {e}")
            results[url] = ("", "")
        finally:
            if context:
                try:
                    await context.close()
                except Exception:
                    pass

    tasks = [_fetch_one(url) for url in urls]
    await asyncio.gather(*tasks, return_exceptions=True)
    return results


# ── Public API ──────────────────────────────────────────────────────

async def fetch_metadata_for_urls(
    urls: list[str], *, progress_cb=None,
) -> dict[str, Optional[dict]]:
    """
    Fetch metadata for URLs. Fast path: httpx → regex → AI batch → browser fallback.
    """
    unique_urls = [u for u in dict.fromkeys(urls) if not _should_skip_detail_enrichment(u)]
    if not unique_urls:
        return {}

    results: dict[str, Optional[dict]] = {}
    ai_inputs: list[dict] = []
    urls_needing_browser: list[str] = []

    print(f"[Enrichment] Fetching {len(unique_urls)} detail pages via httpx...")

    # ── Step 1: httpx fetch ALL URLs in parallel ──
    sem = asyncio.Semaphore(_CONCURRENCY_HTTP)

    async def _limited_fetch(client: httpx.AsyncClient, url: str):
        async with sem:
            return await _fetch_page_text(client, url)

    async with httpx.AsyncClient(
        headers={"User-Agent": _UA},
        follow_redirects=True,
    ) as client:
        fetch_results = await asyncio.gather(
            *[_limited_fetch(client, url) for url in unique_urls],
            return_exceptions=True,
        )

    http_success = 0
    for r in fetch_results:
        if isinstance(r, Exception) or not isinstance(r, tuple):
            continue
        url, title, text = r
        if text and len(text) > 80:
            http_success += 1
            # Regex over full HTML-extracted page text is only reliable for salary.
            regex_meta = _regex_salary_only(extract_all(text))
            results[url] = regex_meta if regex_meta else None

            # Queue for AI if regex didn't fill everything
            if not _has_complete_meta(regex_meta):
                ai_inputs.append({
                    "id": url,
                    "title": title,
                    "company": "",
                    "location_str": "",
                    "snippet": "",
                    "detail_text": _compact_for_ai(text),
                })
        else:
            # httpx failed — queue for browser fallback
            urls_needing_browser.append(url)

    print(f"[Enrichment] httpx: {http_success}/{len(unique_urls)} pages fetched, "
          f"{len(ai_inputs)} need AI, {len(urls_needing_browser)} need browser")

    # ── Step 2: AI batch extraction ──
    if ai_inputs:
        try:
            ai_results = await extract_metadata_ai_batch(
                ai_inputs,
                source="detail-page",
                context="httpx-fetch",
                progress_cb=progress_cb,
            )
            for url, meta in ai_results.items():
                if not meta:
                    continue
                # Add source tags
                for field in ("experience_str", "job_type_str", "salary_str", "work_mode_str", "apply_method_str"):
                    if meta.get(field):
                        meta[f"{field.replace('_str', '_src')}"] = "openai"
                results[url] = _merge_missing_fields(results.get(url), meta) or None
        except Exception as e:
            print(f"[Enrichment] AI batch error: {e}")

    # ── Step 3: Browser fallback for httpx failures ──
    browser_urls = urls_needing_browser[:_BROWSER_FALLBACK_LIMIT]
    if browser_urls:
        print(f"[Enrichment] Browser fallback for {len(browser_urls)} URLs...")
        browser_texts = await _fetch_browser_batch(browser_urls)

        browser_ai_inputs: list[dict] = []
        for url, (title, text) in browser_texts.items():
            if not text or len(text) < 80:
                results[url] = None
                continue

            regex_meta = _regex_salary_only(extract_all(text))
            results[url] = regex_meta if regex_meta else None

            if not _has_complete_meta(regex_meta):
                browser_ai_inputs.append({
                    "id": url,
                    "title": title,
                    "company": "",
                    "location_str": "",
                    "snippet": "",
                    "detail_text": _compact_for_ai(text),
                })

        if browser_ai_inputs:
            try:
                ai_results = await extract_metadata_ai_batch(
                    browser_ai_inputs,
                    source="detail-page",
                    context="browser-fallback",
                )
                for url, meta in ai_results.items():
                    if not meta:
                        continue
                    for field in ("experience_str", "job_type_str", "salary_str", "work_mode_str"):
                        if meta.get(field):
                            meta[f"{field.replace('_str', '_src')}"] = "openai"
                    results[url] = _merge_missing_fields(results.get(url), meta) or None
            except Exception as e:
                print(f"[Enrichment] Browser AI batch error: {e}")

    # Log summary
    filled = sum(1 for m in results.values() if m and any(
        m.get(f) for f in ("experience_str", "job_type_str", "salary_str", "work_mode_str")
    ))
    complete = sum(1 for m in results.values() if _has_complete_meta(m))
    print(f"[Enrichment] Done — {filled}/{len(unique_urls)} with data, {complete} complete")

    return results


async def enrich_jobs(jobs: list[dict]) -> None:
    """Background task: enrich jobs missing metadata and persist to DB."""
    urls_to_enrich = []
    for job in jobs:
        has_all = all(
            job.get(f) for f in ("experience_str", "job_type_str", "salary_str", "work_mode_str")
        )
        if not has_all:
            url = job["url"]
            if _should_skip_detail_enrichment(url):
                continue
            urls_to_enrich.append(url)

    if not urls_to_enrich:
        return

    existing = get_metadata_batch(urls_to_enrich)
    urls_to_fetch = [u for u in urls_to_enrich if not _has_complete_meta(existing.get(u))]

    if not urls_to_fetch:
        return

    print(f"[Enrichment] Background: enriching {len(urls_to_fetch)} jobs...")

    enriched_results = await fetch_metadata_for_urls(urls_to_fetch)
    enriched = 0
    for url, meta in enriched_results.items():
        if meta:
            try:
                upsert_metadata(url, **meta)
                enriched += 1
            except Exception as e:
                print(f"[Enrichment] DB error for {url}: {e}")

    print(f"[Enrichment] Background done — enriched {enriched}/{len(urls_to_fetch)}")


async def prepare_jobs_for_search(jobs: list[dict], *, progress_cb=None) -> list[dict]:
    """
    Synchronously hydrate search candidates with normalized metadata before filtering.
    Uses DB cache first, then fetches uncached detail pages so the first response
    is filtered against richer metadata instead of title/snippet guesses.
    """
    if not jobs:
        return jobs

    unique_urls = list(dict.fromkeys(job["url"] for job in jobs if job.get("url")))
    if not unique_urls:
        return jobs

    for job in jobs:
        _drop_low_trust_regex_fields(job)

    stored = get_metadata_batch(unique_urls)
    for job in jobs:
        if meta := stored.get(job["url"]):
            _apply_metadata_to_job(job, meta, overwrite_non_structured=True)

    urls_to_fetch = [
        url
        for url in unique_urls
        if not _should_skip_detail_enrichment(url) and not _has_complete_meta(stored.get(url))
    ]
    if not urls_to_fetch:
        return jobs

    print(
        f"[SearchPrep] Sync enrichment for {len(urls_to_fetch)}/{len(unique_urls)} "
        "jobs before filtering"
    )
    fetched = await fetch_metadata_for_urls(urls_to_fetch, progress_cb=progress_cb)
    for url, meta in fetched.items():
        if not meta:
            continue
        try:
            upsert_metadata(url, **meta)
        except Exception as e:
            print(f"[SearchPrep] DB error for {url}: {e}")
        stored[url] = _merge_missing_fields(stored.get(url), meta)

    for job in jobs:
        if meta := stored.get(job["url"]):
            _apply_metadata_to_job(job, meta, overwrite_non_structured=True)

    return jobs


def merge_metadata_into_jobs(jobs: list[dict]) -> list[dict]:
    """Merge persisted metadata from job_metadata table into job listing dicts."""
    for job in jobs:
        _drop_low_trust_regex_fields(job)

    urls_needing = []
    for job in jobs:
        has_all = all(
            job.get(f) for f in ("experience_str", "job_type_str", "salary_str", "work_mode_str")
        )
        if not has_all:
            urls_needing.append(job["url"])

    if not urls_needing:
        return jobs

    stored = get_metadata_batch(urls_needing)
    if not stored:
        return jobs

    for job in jobs:
        meta = stored.get(job["url"])
        if meta:
            _apply_metadata_to_job(job, meta, overwrite_non_structured=False)

    return jobs
