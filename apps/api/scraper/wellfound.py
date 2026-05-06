"""Wellfound (formerly AngelList Talent) scraper.

Strategy (in order of reliability):
1. Intercept JSON API / GraphQL responses from wellfound.com while loading
2. Extract job data from Next.js __NEXT_DATA__ embedded in page HTML
3. Broad DOM selector fallback
"""

import json as json_lib
import re
from typing import Optional
from urllib.parse import quote_plus

from playwright_stealth import Stealth
from scraper import get_browser
from models.schemas import JobListing, JobSource, LocationFilter
from scraper._common import (
    basic_text_match,
    date_posted_cutoff,
    location_includes_remote,
    normalize_query,
    parse_iso_date,
    relative_to_iso,
    resolve_location_label,
)
from utils.job_meta_extractor import extract_all as extract_meta
from utils.job_meta_extractor import primary_experience_value


WELLFOUND_BASE = "https://wellfound.com"


def _find_job_arrays(node, depth: int = 0) -> list[list]:
    """Recursively find arrays that look like job listings inside a JSON tree.

    Handles both direct arrays and Relay-style GraphQL edges [{node: {...}}, ...].
    """
    if depth > 15:
        return []
    found: list[list] = []
    if isinstance(node, list) and len(node) > 0:
        sample = node[0]
        if not isinstance(sample, dict):
            return []
        # Relay GraphQL edges: [{node: {title, ...}}, ...]
        if "node" in sample and isinstance(sample.get("node"), dict):
            inner = [
                item["node"] for item in node
                if isinstance(item, dict) and isinstance(item.get("node"), dict)
            ]
            if inner:
                deeper = _find_job_arrays(inner, depth + 1)
                return deeper if deeper else (found + [inner] if any(k in inner[0] for k in ("title", "jobTitle", "position", "name")) else found)
            return found
        # Direct job array — only require a title-like field (very permissive)
        if any(k in sample for k in ("title", "position", "jobTitle", "name")):
            found.append(node)
            return found
        for item in node:
            found.extend(_find_job_arrays(item, depth + 1))
    elif isinstance(node, dict):
        for v in node.values():
            found.extend(_find_job_arrays(v, depth + 1))
    return found


def _parse_job_item(item: dict, q: str, loc_label: str | None) -> Optional[JobListing]:
    title = (
        item.get("title") or item.get("jobTitle") or item.get("position") or item.get("name") or ""
    ).strip()
    if not title:
        return None

    # Resolve company + logo from flat fields OR nested startup object
    startup = item.get("startup") or item.get("company_obj") or {}
    if not isinstance(startup, dict):
        startup = {}

    company = (
        item.get("startupName") or
        item.get("companyName") or
        item.get("organizationName") or
        (startup.get("name") if startup else None) or
        (item.get("company") if isinstance(item.get("company"), str) else None) or
        "N/A"
    ).strip()

    logo_url = (
        item.get("startupLogoUrl") or
        item.get("logoUrl") or
        item.get("companyLogoUrl") or
        startup.get("logoUrl") or
        startup.get("logoThumb") or
        startup.get("thumbnailUrl") or
        None
    )

    # Build job URL from slug/id — prefer startup-scoped URL
    slug = item.get("slug") or item.get("jobSlug") or ""
    startup_slug = (
        item.get("startupSlug") or
        item.get("companySlug") or
        startup.get("slug") or
        ""
    )
    job_id = item.get("id") or item.get("jobId") or slug or ""

    if startup_slug and job_id:
        job_url = f"{WELLFOUND_BASE}/company/{startup_slug}/jobs/{job_id}"
    elif job_id:
        job_url = f"{WELLFOUND_BASE}/jobs/{job_id}"
    else:
        job_url = item.get("applyUrl") or item.get("url") or ""
    if not job_url:
        return None
    if not job_url.startswith("http"):
        job_url = f"{WELLFOUND_BASE}{job_url}"

    # Location
    location_names = item.get("locationNames") or item.get("locations") or []
    if isinstance(location_names, list):
        location_str = ", ".join(str(l) for l in location_names[:2]) or loc_label or ""
    else:
        location_str = str(location_names) or loc_label or ""

    # Date
    date_raw = (
        item.get("liveStartAt") or
        item.get("postedAt") or
        item.get("createdAt") or
        item.get("datePosted") or
        ""
    )
    date_iso = parse_iso_date(date_raw)

    # Work mode
    is_remote = item.get("remote") or item.get("isRemote") or False
    lc_loc = location_str.lower()
    if is_remote or "remote" in lc_loc:
        work_mode_str = "Remote"
    elif "hybrid" in lc_loc:
        work_mode_str = "Hybrid"
    else:
        work_mode_str = None

    # Job type
    jt_raw = (item.get("jobType") or item.get("employmentType") or "").lower()
    if "full" in jt_raw:
        job_type_str: Optional[str] = "Full-time"
    elif "part" in jt_raw:
        job_type_str = "Part-time"
    elif "contract" in jt_raw:
        job_type_str = "Contract"
    elif "intern" in jt_raw:
        job_type_str = "Internship"
    else:
        job_type_str = "Full-time"

    salary_str = item.get("compensation") or item.get("salary") or item.get("salaryText") or None
    if isinstance(salary_str, dict):
        salary_str = None

    description_snippet = item.get("description") or ""
    if description_snippet:
        description_snippet = re.sub(r"<[^>]+>", " ", description_snippet)[:1500]

    combined_text = f"{title} {company} {location_str} {description_snippet}"
    if not basic_text_match(q, title, company, combined_text):
        return None

    meta = extract_meta(combined_text or title)

    return JobListing(
        title=title,
        company=company,
        url=job_url,
        date_posted=(date_iso.isoformat() if date_iso else date_raw),
        source=JobSource.wellfound,
        logo_url=logo_url,
        location_str=location_str,
        description_snippet=description_snippet or None,
        salary_str=str(salary_str) if salary_str else meta.get("salary_str"),
        salary_src="structured" if salary_str else ("regex" if meta.get("salary_str") else None),
        work_mode_str=work_mode_str or meta.get("work_mode_str"),
        work_mode_src="structured" if work_mode_str else ("rule" if meta.get("work_mode_str") else None),
        job_type_str=job_type_str,
        job_type_src="structured",
        seniority_str=meta.get("seniority_str"),
        seniority_src="rule" if meta.get("seniority_str") else None,
        experience_str=primary_experience_value(meta.get("seniority_str"), meta.get("experience_years_str")),
        experience_src="rule" if meta.get("seniority_str") or meta.get("experience_years_str") else None,
    )


async def scrape_wellfound(
    query: str,
    location: Optional[LocationFilter] = None,
    work_modes: Optional[list[str]] = None,
    experience: Optional[list[str]] = None,
    job_types: Optional[list[str]] = None,
    date_posted: Optional[str] = None,
    sort_by: Optional[str] = None,
) -> list[JobListing]:
    from services.admin_log_service import log_scraper_start, log_scraper_done, log_scraper_error, log_bot_blocked
    log_scraper_start("wellfound", query)
    context = None
    try:
        browser = await get_browser()
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
            locale="en-US",
            viewport={"width": 1280, "height": 800},
        )
        await context.route(
            "**/*.{png,jpg,jpeg,gif,webp,woff,woff2,ttf,otf}",
            lambda route: route.abort(),
        )
        page = await context.new_page()
        await Stealth().apply_stealth_async(page)

        q = normalize_query(query)
        loc_label = resolve_location_label(location)

        params = [f"keywords={quote_plus(q)}"]
        if loc_label:
            params.append(f"location={quote_plus(loc_label)}")
        if work_modes and "remote" in [w.lower() for w in work_modes] or location_includes_remote(location):
            params.append("remote=true")

        url = f"{WELLFOUND_BASE}/jobs?{'&'.join(params)}"

        # ── Step 1: intercept JSON API / GraphQL responses ──
        captured_data: list[dict | list] = []

        async def handle_response(response):
            try:
                if response.status != 200:
                    return
                ct = response.headers.get("content-type", "")
                if "json" not in ct and "graphql" not in ct:
                    return
                data = await response.json()
                if data:
                    captured_data.append(data)
            except Exception:
                pass

        page.on("response", handle_response)

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=25000)
            await page.wait_for_timeout(8000)
        except Exception:
            log_scraper_done("wellfound", query, 0)
            return []

        # CF / login detection
        page_title = (await page.title()).lower()
        if any(kw in page_title for kw in ("just a moment", "cloudflare", "checking your", "verify")):
            log_scraper_done("wellfound", query, 0)
            return []
        current_url = page.url
        if any(kw in current_url for kw in ("/login", "/signin", "/auth", "/sign-in")):
            log_bot_blocked("wellfound", query)
            return []

        # Scroll to trigger lazy loads
        for _ in range(3):
            try:
                await page.evaluate("window.scrollBy(0, window.innerHeight)")
                await page.wait_for_timeout(500)
            except Exception:
                break

        cutoff = date_posted_cutoff(date_posted)
        results: list[JobListing] = []
        seen: set[str] = set()

        # ── Step 2: extract from captured API/GraphQL responses ──
        for data in captured_data:
            arrays = _find_job_arrays(data)
            for arr in arrays:
                for item in arr:
                    try:
                        listing = _parse_job_item(item, q, loc_label)
                        if listing and listing.url not in seen:
                            if cutoff and (d := parse_iso_date(listing.date_posted)) and d < cutoff:
                                continue
                            seen.add(listing.url)
                            results.append(listing)
                    except Exception:
                        continue

        # ── Step 3: __NEXT_DATA__ extraction ──
        if not results:
            try:
                html_content = await page.content()
                m = re.search(
                    r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',
                    html_content,
                    re.DOTALL,
                )
                if m:
                    next_data = json_lib.loads(m.group(1))
                    arrays = _find_job_arrays(next_data)
                    for arr in arrays:
                        for item in arr:
                            try:
                                listing = _parse_job_item(item, q, loc_label)
                                if listing and listing.url not in seen:
                                    if cutoff and (d := parse_iso_date(listing.date_posted)) and d < cutoff:
                                        continue
                                    seen.add(listing.url)
                                    results.append(listing)
                            except Exception:
                                continue
            except Exception:
                pass

        # ── Step 4: DOM selector fallback — single JS eval ──
        if not results:
            try:
                dom_cards = await page.evaluate("""() => {
                    const links = Array.from(document.querySelectorAll(
                        'a[href*="/jobs/"], a[href*="/company/"]'
                    ));
                    return links
                        .filter(a => {
                            const h = a.pathname;
                            if (h === '/jobs' || h.endsWith('/jobs')) return false;
                            const parts = h.split('/').filter(Boolean);
                            return parts.length >= 2;
                        })
                        .slice(0, 60)
                        .map(a => {
                            const block = a.closest('li, article, [class*="card"], [class*="listing"]')
                                || a.parentElement || a;
                            const compEl = block.querySelector('h2, h3, [class*="company"], [class*="startup"]');
                            return {
                                href: a.href,
                                linkText: a.innerText.trim().split('\\n')[0],
                                parentText: block.innerText.trim().substring(0, 800),
                                company: compEl ? compEl.innerText.trim() : 'N/A',
                            };
                        });
                }""")
            except Exception:
                dom_cards = []

            for card in (dom_cards or []):
                try:
                    href = card.get("href") or ""
                    if not href:
                        continue
                    full_url = href if href.startswith("http") else f"{WELLFOUND_BASE}{href}"
                    if full_url in seen:
                        continue
                    seen.add(full_url)

                    title = (card.get("linkText") or "").strip()
                    if not title or len(title) > 200:
                        continue

                    parent_text = (card.get("parentText") or "").strip()
                    company = (card.get("company") or "N/A").strip() or "N/A"
                    if company == title:
                        company = "N/A"

                    if not basic_text_match(q, title, company, parent_text):
                        continue

                    lc = (parent_text or title).lower()
                    work_mode_str = "Remote" if "remote" in lc else ("Hybrid" if "hybrid" in lc else None)
                    meta = extract_meta(parent_text or title)

                    results.append(JobListing(
                        title=title,
                        company=company,
                        url=full_url,
                        date_posted=relative_to_iso(parent_text) or "",
                        source=JobSource.wellfound,
                        logo_url=None,
                        location_str=loc_label or ("Remote" if work_mode_str == "Remote" else ""),
                        description_snippet=(parent_text[:1500] if parent_text else None),
                        salary_str=meta.get("salary_str"),
                        salary_src="regex" if meta.get("salary_str") else None,
                        work_mode_str=work_mode_str or meta.get("work_mode_str"),
                        work_mode_src="rule" if work_mode_str or meta.get("work_mode_str") else None,
                        job_type_str=meta.get("job_type_str") or "Full-time",
                        job_type_src="rule" if meta.get("job_type_str") else "default",
                        seniority_str=meta.get("seniority_str"),
                        seniority_src="rule" if meta.get("seniority_str") else None,
                        experience_str=primary_experience_value(meta.get("seniority_str"), meta.get("experience_years_str")),
                        experience_src="rule" if meta.get("seniority_str") or meta.get("experience_years_str") else None,
                    ))
                except Exception:
                    continue

        if sort_by == "job-title-ascending":
            results.sort(key=lambda j: j.title.lower())
        elif sort_by == "job-title-descending":
            results.sort(key=lambda j: j.title.lower(), reverse=True)
        else:
            results.sort(key=lambda j: j.date_posted, reverse=True)

        log_scraper_done("wellfound", query, len(results))
        return results

    except Exception as e:
        log_scraper_error("wellfound", query, str(e))
        return []
    finally:
        try:
            if context:
                await context.close()
        except Exception:
            pass
