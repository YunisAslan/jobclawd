"""LinkedIn job scraper — non-fatal, returns [] on any error."""

from urllib.parse import quote_plus, urlsplit, urlunsplit
from typing import Optional

from playwright_stealth import Stealth
from scraper import get_browser
from models.schemas import JobListing, JobSource, LocationFilter
from db.database import get_db
from services.ai_metadata_extractor import extract_metadata_ai_batch
from services.enrichment_service import fetch_metadata_for_urls
from utils.job_meta_extractor import extract_all as extract_meta
from utils.job_meta_extractor import primary_experience_value

_INITIAL_RESULTS_WAIT_MS = 1200
_SCROLL_PAUSE_MS = 350
_MAX_SCROLL_ROUNDS = 12
_STALL_ROUNDS_BEFORE_STOP = 3
_SYNC_DETAIL_ENRICH_LIMIT = 40


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
    return not all([
        job.salary_str,
        job.job_type_str,
        primary_experience_value(job.seniority_str, job.experience_years_str) or job.experience_str,
        job.work_mode_str,
    ])


def _merge_missing_fields_with_source(
    job: JobListing, meta: dict, field_sources: dict, source: str
) -> None:
    if not job.seniority_str and meta.get("seniority_str"):
        job.seniority_str = meta["seniority_str"]
        job.seniority_src = source
        field_sources["seniority_str"] = source
    if not job.experience_years_str and meta.get("experience_years_str"):
        job.experience_years_str = meta["experience_years_str"]
        job.experience_years_src = source
        field_sources["experience_years_str"] = source
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
    primary_experience = primary_experience_value(job.seniority_str, job.experience_years_str)
    if primary_experience and not job.experience_str:
        job.experience_str = primary_experience
        job.experience_src = job.seniority_src if job.seniority_str else job.experience_years_src
        field_sources["experience_str"] = source


def _log_meta_trace(job: JobListing, field_sources: dict, *, context: str) -> None:
    resolved = {
        "salary": field_sources.get("salary_str", "-"),
        "job_type": field_sources.get("job_type_str", "-"),
        "experience": field_sources.get("seniority_str", field_sources.get("experience_years_str", field_sources.get("experience_str", "-"))),
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


async def _detect_linkedin_block(page) -> str | None:
    """Return a block reason string if LinkedIn is blocking us, else None."""
    try:
        title = (await page.title()).lower()
        url = page.url.lower()
        content = await page.evaluate("document.body?.innerText?.slice(0, 500) || ''")
        content_lower = content.lower()
        if "captcha" in title or "captcha" in content_lower:
            return "captcha"
        if "authwall" in url or "login" in url or "uas/login" in url:
            return "login_wall"
        if "security verification" in content_lower or "verify you're human" in content_lower:
            return "captcha"
        if "we're sorry" in content_lower and "robot" in content_lower:
            return "bot_blocked"
    except Exception:
        pass
    return None


async def scrape_linkedin(
    query: str,
    location: Optional[LocationFilter] = None,
    work_modes: Optional[list[str]] = None,
    experience: Optional[list[str]] = None,
    job_types: Optional[list[str]] = None,
    date_posted: Optional[str] = None,
    sort_by: Optional[str] = None,
) -> list[JobListing]:
    from services.admin_log_service import alog, log_scraper_start, log_scraper_done, log_captcha, log_bot_blocked, log_login_wall, log_timeout, log_scraper_error
    log_scraper_start("linkedin", query)
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
            block = await _detect_linkedin_block(page)
            if block == "captcha":
                log_captcha("linkedin", query, base_url)
                return []
            if block == "login_wall":
                log_login_wall("linkedin", query)
                return []
            if block == "bot_blocked":
                log_bot_blocked("linkedin", query, "Anti-bot page shown")
                return []
            await page.wait_for_selector(".job-search-card", timeout=5000)
            await page.wait_for_timeout(_INITIAL_RESULTS_WAIT_MS)
        except Exception as e:
            err = str(e).lower()
            if "timeout" in err:
                log_timeout("linkedin", query)
            else:
                log_scraper_error("linkedin", query, str(e))
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
                seniority_str = text_meta.get("seniority_str")
                experience_years_str = text_meta.get("experience_years_str")
                experience_str = primary_experience_value(seniority_str, experience_years_str)
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

                badge_lines: list[str] = []
                for raw_line in full_card_text.splitlines():
                    line = " ".join(raw_line.split()).strip()
                    if not line or len(line) > 40:
                        continue
                    lowered = line.lower()
                    if any(
                        token in lowered
                        for token in (
                            "remote",
                            "hybrid",
                            "on-site",
                            "onsite",
                            "full-time",
                            "part-time",
                            "contract",
                            "intern",
                            "junior",
                            "mid",
                            "senior",
                            "lead",
                            "manager",
                            "easy apply",
                        )
                    ):
                        badge_lines.append(line)

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
                        seniority_str=seniority_str,
                        seniority_src="rule" if seniority_str else None,
                        experience_years_str=experience_years_str,
                        experience_years_src="rule" if experience_years_str else None,
                        experience_str=experience_str,
                        experience_src="rule" if experience_str else None,
                        salary_str=text_meta.get("salary_str"),
                        salary_src=field_sources.get("salary_str"),
                    )
                )
                jobs[-1].__dict__["_card_data"] = {
                    "labels": [value for value in badge_lines if value],
                    "card_badges": [value for value in badge_lines if value],
                    "topline_labels": [value for value in badge_lines if value],
                    "employment_type": text_meta.get("job_type_str"),
                    "seniority_level": seniority_str,
                    "experience_years": experience_years_str,
                    "workplace_type": text_meta.get("work_mode_str"),
                    "salary": text_meta.get("salary_str"),
                    "has_easy_apply_badge": has_easy_apply,
                }
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

        # ── Step 2: Detail-page enrichment for remaining gaps ──
        detail_candidates = [
            (idx, job.url)
            for idx, job in enumerate(jobs)
            if _has_missing_metadata(job)
        ][:_SYNC_DETAIL_ENRICH_LIMIT]

        if detail_candidates:
            print(f"[LinkedIn] Enriching {len(detail_candidates)} jobs via detail pages...")
            try:
                detail_results = await fetch_metadata_for_urls(
                    [url for _, url in detail_candidates]
                )
                for idx, url in detail_candidates:
                    meta = detail_results.get(url)
                    if not meta:
                        continue
                    _merge_missing_fields_with_source(
                        jobs[idx], meta, job_field_sources[idx], "detail-page"
                    )
            except Exception as e:
                print(f"[LinkedIn] Detail enrichment error: {e}")

        for idx, job in enumerate(jobs):
            _log_meta_trace(
                job,
                job_field_sources[idx] if idx < len(job_field_sources) else {},
                context="final",
            )

        log_scraper_done("linkedin", query, len(jobs))
        return jobs

    except Exception as e:
        log_scraper_error("linkedin", query, str(e))
        return []
    finally:
        try:
            if context:
                await context.close()
        except Exception:
            pass
