"""LinkedIn job scraper — non-fatal, returns [] on any error."""

from urllib.parse import quote_plus, urlsplit, urlunsplit
from typing import Optional

from playwright_stealth import Stealth
from scraper import get_browser
from models.schemas import JobListing, JobSource, LocationFilter
from db.database import get_db
from services.ai_metadata_extractor import extract_metadata_ai_batch
from services.apply_method_detector import detect_from_linkedin_card
from utils.job_meta_extractor import extract_all as extract_meta

_INITIAL_RESULTS_WAIT_MS = 1200
_SCROLL_PAUSE_MS = 350
_MAX_SCROLL_ROUNDS = 12
_STALL_ROUNDS_BEFORE_STOP = 3


def _normalize_linkedin_job_url(url: str) -> str:
    raw = (url or "").strip()
    if not raw:
        return ""

    parts = urlsplit(raw)
    host = (parts.netloc or "").lower()
    if host.endswith(".linkedin.com") or host == "linkedin.com":
        host = "www.linkedin.com"

    normalized = urlunsplit((
        parts.scheme or "https",
        host,
        parts.path.rstrip("/"),
        "",
        "",
    ))
    return normalized


def _has_missing_metadata(job: JobListing) -> bool:
    return not all([job.salary_str, job.job_type_str, job.experience_str, job.work_mode_str])


def _merge_missing_fields_with_source(
    job: JobListing, meta: dict, field_sources: dict, source: str
) -> None:
    if not job.salary_str and meta.get("salary_str"):
        job.salary_str = meta["salary_str"]
        job.salary_src = source
        field_sources["salary_str"] = source
    if not job.job_type_str and meta.get("job_type_str"):
        job.job_type_str = meta["job_type_str"]
        job.job_type_src = source
        field_sources["job_type_str"] = source
    if not job.experience_str and meta.get("experience_str"):
        job.experience_str = meta["experience_str"]
        job.experience_src = source
        field_sources["experience_str"] = source
    if not job.work_mode_str and meta.get("work_mode_str"):
        job.work_mode_str = meta["work_mode_str"]
        job.work_mode_src = source
        field_sources["work_mode_str"] = source


def _log_meta_trace(job: JobListing, field_sources: dict, *, context: str) -> None:
    resolved = {
        "salary": field_sources.get("salary_str", "-"),
        "job_type": field_sources.get("job_type_str", "-"),
        "experience": field_sources.get("experience_str", "-"),
        "work_mode": field_sources.get("work_mode_str", "-"),
    }
    print(
        f"[MetaTrace][LinkedIn][{context}] "
        f"title={job.title[:60]!r} "
        f"salary={resolved['salary']} "
        f"job_type={resolved['job_type']} "
        f"experience={resolved['experience']} "
        f"work_mode={resolved['work_mode']}"
    )


async def scrape_linkedin(
    query: str,
    location: Optional[LocationFilter] = None,
    work_modes: Optional[list[str]] = None,
    experience: Optional[list[str]] = None,
    job_types: Optional[list[str]] = None,
    date_posted: Optional[str] = None,
    sort_by: Optional[str] = None,
) -> list[JobListing]:
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
            viewport={"width": 1280, "height": 720},
        )

        await context.route(
            "**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,otf}",
            lambda route: route.abort(),
        )

        page = await context.new_page()
        await Stealth().apply_stealth_async(page)

        encoded_query = quote_plus(query)
        target_location = "Worldwide"
        if location and location.type in ["country", "city"]:
            val = None
            if location.values and len(location.values) > 0:
                val = location.values[0]
            elif location.value:
                val = location.value

            if val:
                if location.type == "country":
                    with get_db() as conn:
                        row = conn.execute(
                            "SELECT name FROM countries WHERE code = %s", (val,)
                        ).fetchone()
                        if row:
                            target_location = row["name"]
                elif location.type == "city":
                    with get_db() as conn:
                        row = conn.execute(
                            "SELECT name FROM cities WHERE value = %s", (val,)
                        ).fetchone()
                        if row:
                            target_location = row["name"]
                        else:
                            target_location = (
                                val.split("-")[1].title()
                                if "-" in val
                                else val.title()
                            )

        encoded_location = quote_plus(target_location)
        base_url = (
            f"https://www.linkedin.com/jobs/search/"
            f"?keywords={encoded_query}&location={encoded_location}"
        )

        wt_flags = []
        if work_modes:
            if "remote" in work_modes:
                wt_flags.append("2")
            if "hybrid" in work_modes:
                wt_flags.append("3")
            if "onsite" in work_modes:
                wt_flags.append("1")
        if wt_flags:
            base_url += f"&f_WT={','.join(wt_flags)}"

        e_flags = []
        if experience:
            if "junior" in experience:
                e_flags.append("2")
            if "mid" in experience:
                e_flags.append("3")
            if "senior" in experience or "lead" in experience:
                e_flags.append("4")
            if "freshmen" in experience or "intern" in experience:
                e_flags.append("1")
        if e_flags:
            base_url += f"&f_E={','.join(e_flags)}"

        jt_flags = []
        if job_types:
            if "full-time" in job_types:
                jt_flags.append("F")
            if "part-time" in job_types:
                jt_flags.append("P")
            if "contract" in job_types:
                jt_flags.append("C")
            if "internship" in job_types:
                jt_flags.append("I")
                if "1" not in e_flags:
                    base_url += "&f_E=1"
        if jt_flags:
            base_url += f"&f_JT={','.join(jt_flags)}"

        if date_posted in ("1d", "today", "past-24h"):
            base_url += "&f_TPR=r86400"
        elif date_posted in ("3d",):
            base_url += "&f_TPR=r259200"
        elif date_posted in ("7d", "past-week"):
            base_url += "&f_TPR=r604800"
        elif date_posted in ("1m", "past-month"):
            base_url += "&f_TPR=r2592000"

        if sort_by == "relevance":
            base_url += "&sortBy=R"
        else:
            base_url += "&sortBy=DD"

        try:
            await page.goto(base_url, wait_until="domcontentloaded", timeout=25000)
            await page.wait_for_selector(".job-search-card", timeout=5000)
            await page.wait_for_timeout(_INITIAL_RESULTS_WAIT_MS)
        except Exception:
            return []

        jobs: list[JobListing] = []
        job_field_sources: list[dict[str, str]] = []
        seen_urls: set[str] = set()

        card_count = 0
        stalled_rounds = 0
        for _ in range(_MAX_SCROLL_ROUNDS):
            current_count = await page.locator(".job-search-card").count()
            if current_count > card_count:
                card_count = current_count
                stalled_rounds = 0
            else:
                stalled_rounds += 1
                if stalled_rounds >= _STALL_ROUNDS_BEFORE_STOP:
                    break

            await page.evaluate("window.scrollBy(0, Math.max(window.innerHeight, 900))")
            await page.wait_for_timeout(_SCROLL_PAUSE_MS)

        cards = await page.query_selector_all(".job-search-card")
        print(
            f"[LinkedIn] Found {len(cards)} cards for "
            f"'{query}' @ location={target_location}"
        )

        for card in cards:
            try:
                title_el = await card.query_selector(".base-search-card__title")
                company_el = await card.query_selector(".base-search-card__subtitle")
                location_el = await card.query_selector(".job-search-card__location")
                link_el = await card.query_selector("a.base-card__full-link")
                time_el = await card.query_selector("time[datetime]")
                logo_el = await card.query_selector("img.artdeco-entity-image")

                title = (await title_el.inner_text()).strip() if title_el else ""
                company = (
                    (await company_el.inner_text()).strip() if company_el else ""
                )
                location_str = (
                    (await location_el.inner_text()).strip() if location_el else ""
                )
                href = await link_el.get_attribute("href") if link_el else ""
                date_str = (
                    await time_el.get_attribute("datetime") if time_el else ""
                )
                logo_url = await logo_el.get_attribute("src") if logo_el else None

                if not title or not href:
                    continue

                clean_url = _normalize_linkedin_job_url(href)
                if clean_url in seen_urls:
                    continue
                seen_urls.add(clean_url)

                snippet = ""
                try:
                    snippet_el = await card.query_selector(
                        ".base-search-card__metadata"
                    )
                    if snippet_el:
                        snippet = (await snippet_el.inner_text()).strip()[:500]
                except Exception:
                    pass

                # Grab full card text for regex fallback
                full_card_text = ""
                try:
                    full_card_text = (await card.inner_text()).strip()
                except Exception:
                    full_card_text = f"{title} {company} {location_str} {snippet}"

                # ── Quick regex pass on card text — salary only ──
                # Experience, job_type, work_mode are handled by AI below.
                # Regex keyword matching causes false positives.
                field_sources: dict[str, str] = {}
                text_meta = extract_meta(full_card_text)
                if text_meta.get("salary_str"):
                    field_sources["salary_str"] = "fallback"

                has_easy_apply = False
                try:
                    card_text_lower = full_card_text.lower()
                    has_easy_apply = (
                        "easy apply" in card_text_lower
                        or "easyapply" in card_text_lower
                    )
                    if not has_easy_apply:
                        ea_el = await card.query_selector(
                            ".job-search-card__easy-apply-label, "
                            "[class*='easy-apply'], "
                            ".result-benefits__text"
                        )
                        if ea_el:
                            ea_text = (await ea_el.inner_text()).lower()
                            has_easy_apply = "easy" in ea_text
                except Exception:
                    pass

                apply_method = detect_from_linkedin_card(
                    {"has_easy_apply_badge": has_easy_apply}
                )

                jobs.append(
                    JobListing(
                        title=title,
                        company=company,
                        url=clean_url,
                        date_posted=date_str or "",
                        source=JobSource.linkedin,
                        logo_url=logo_url,
                        location_str=location_str,
                        description_snippet=(full_card_text[:2000] or snippet or None),
                        apply_method=apply_method,
                        salary_str=text_meta.get("salary_str"),
                        salary_src=field_sources.get("salary_str"),
                    )
                )
                job_field_sources.append(field_sources)
            except Exception:
                continue

        # ── Step 1: AI extraction on card text (title + location + snippet) ──
        # The AI can extract experience from title ("Senior", "Junior"),
        # work mode from location ("Remote"), and job type from context.
        ai_candidates = []
        ai_index_map: dict[str, int] = {}
        for idx, job in enumerate(jobs):
            if not _has_missing_metadata(job):
                continue
            item_id = str(idx)
            ai_index_map[item_id] = idx
            ai_candidates.append(
                {
                    "id": item_id,
                    "title": job.title,
                    "company": job.company,
                    "location_str": job.location_str or "",
                    "snippet": job.description_snippet or "",
                    "detail_text": "",
                }
            )

        if ai_candidates:
            print(f"[LinkedIn] AI extracting from {len(ai_candidates)} card titles...")
            try:
                ai_results = await extract_metadata_ai_batch(
                    ai_candidates,
                    source="linkedin",
                    context="search-card",
                )
                for item_id, meta in ai_results.items():
                    idx = ai_index_map.get(item_id)
                    if idx is None:
                        continue
                    _merge_missing_fields_with_source(
                        jobs[idx], meta, job_field_sources[idx], "openai"
                    )
            except Exception as e:
                print(f"[LinkedIn] AI card extraction error: {e}")

        missing_after_cards = sum(1 for job in jobs if _has_missing_metadata(job))
        if missing_after_cards:
            print(
                f"[LinkedIn] Deferring detail enrichment for {missing_after_cards} jobs "
                "to background metadata fetch"
            )

        for idx, job in enumerate(jobs):
            _log_meta_trace(
                job,
                job_field_sources[idx] if idx < len(job_field_sources) else {},
                context="final",
            )

        return jobs

    except Exception:
        return []
    finally:
        try:
            if context:
                await context.close()
        except Exception:
            pass
