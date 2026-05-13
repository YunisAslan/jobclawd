"""Glassdoor scraper — public job search.

Best-effort: Glassdoor uses heavy anti-bot (Cloudflare + their own gating).
Returns [] on any failure rather than raising.
"""

from typing import Optional
from urllib.parse import quote_plus

from scraper import get_browser
from models.schemas import JobListing, JobSource, LocationFilter
from scraper._common import (
    basic_text_match,
    date_posted_cutoff,
    normalize_query,
    parse_iso_date,
    relative_to_iso,
    resolve_location_label,
)
from utils.job_meta_extractor import extract_all as extract_meta
from utils.job_meta_extractor import primary_experience_value


GLASSDOOR_BASE = "https://www.glassdoor.com"


async def scrape_glassdoor(
    query: str,
    location: Optional[LocationFilter] = None,
    work_modes: Optional[list[str]] = None,
    experience: Optional[list[str]] = None,
    job_types: Optional[list[str]] = None,
    date_posted: Optional[str] = None,
    sort_by: Optional[str] = None,
) -> list[JobListing]:
    from services.admin_log_service import log_scraper_start, log_scraper_done, log_scraper_error, log_captcha, log_bot_blocked, log_cloudflare, log_timeout
    log_scraper_start("glassdoor", query)
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

        q = normalize_query(query)
        loc_label = resolve_location_label(location) or "United States"

        params = [f"sc.keyword={quote_plus(q)}", f"locKeyword={quote_plus(loc_label)}"]
        # Date posted: fromAge=1|3|7|14|30
        if date_posted in ("1d", "today", "past-24h"):
            params.append("fromAge=1")
        elif date_posted == "3d":
            params.append("fromAge=3")
        elif date_posted in ("7d", "past-week"):
            params.append("fromAge=7")
        elif date_posted in ("1m", "past-month"):
            params.append("fromAge=30")

        # Work modes — Glassdoor uses remoteWorkType=1 for Remote
        if work_modes and "remote" in [w.lower() for w in work_modes]:
            params.append("remoteWorkType=1")

        # Job types — jobType=fulltime|parttime|contract|internship
        if job_types:
            for jt in job_types:
                j = jt.lower()
                if j == "full-time":
                    params.append("jobType=fulltime")
                elif j == "part-time":
                    params.append("jobType=parttime")
                elif j == "contract":
                    params.append("jobType=contract")
                elif j == "internship":
                    params.append("jobType=internship")

        # Sort
        if sort_by != "job-title-ascending" and sort_by != "job-title-descending":
            params.append("sortBy=date_desc")

        url = f"{GLASSDOOR_BASE}/Job/jobs.htm?{'&'.join(params)}"
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=25000)
            # Glassdoor may show a sign-up modal — try to dismiss it
            try:
                close_btn = await page.query_selector(
                    "[data-test='SignUpModalCloseButton'], button.modal_closeIcon, [alt='Close']"
                )
                if close_btn:
                    await close_btn.click()
                    await page.wait_for_timeout(300)
            except Exception:
                pass
            await page.wait_for_selector(
                "li[data-test='jobListing'], div[data-test='jobListing'], a[href*='/job-listing/']",
                timeout=10000,
            )
        except Exception:
            return []

        # Lazy-load
        for _ in range(4):
            try:
                await page.evaluate("window.scrollBy(0, window.innerHeight)")
                await page.wait_for_timeout(400)
            except Exception:
                break

        cards = await page.query_selector_all(
            "li[data-test='jobListing'], div[data-test='jobListing']"
        )
        cutoff = date_posted_cutoff(date_posted)
        results: list[JobListing] = []
        seen: set[str] = set()

        for card in cards:
            try:
                link_el = await card.query_selector("a[data-test='job-link'], a[href*='/job-listing/']")
                href = await link_el.get_attribute("href") if link_el else None
                if not href:
                    continue
                full_url = href if href.startswith("http") else f"{GLASSDOOR_BASE}{href}"
                if full_url in seen:
                    continue
                seen.add(full_url)

                title_el = await card.query_selector("[data-test='job-title'], a[data-test='job-link']")
                title = (await title_el.inner_text()).strip() if title_el else ""
                if not title:
                    continue

                company_el = await card.query_selector("[data-test='employer-name'], .EmployerProfile_compactEmployerName__9MGcV")
                company = (await company_el.inner_text()).strip() if company_el else "N/A"

                location_el = await card.query_selector("[data-test='emp-location'], [data-test='job-location']")
                location_str = (await location_el.inner_text()).strip() if location_el else ""

                salary_el = await card.query_selector("[data-test='detailSalary']")
                salary_text = (await salary_el.inner_text()).strip() if salary_el else ""

                full_text = ""
                try:
                    full_text = (await card.inner_text()).strip()
                except Exception:
                    pass

                if not basic_text_match(q, title, company, full_text):
                    continue

                date_raw = ""
                date_el = await card.query_selector("[data-test='job-age'], time")
                if date_el:
                    date_raw = (await date_el.get_attribute("datetime")) or ""
                    if not date_raw:
                        date_raw = (await date_el.inner_text()).strip()
                date_iso = parse_iso_date(date_raw)
                if not date_iso and date_raw:
                    iso_str = relative_to_iso(date_raw)
                    if iso_str:
                        date_iso = parse_iso_date(iso_str)
                if cutoff and date_iso and date_iso < cutoff:
                    continue

                lc = full_text.lower()
                work_mode_str = None
                if "remote" in lc or "remote" in (location_str or "").lower():
                    work_mode_str = "Remote"
                elif "hybrid" in lc:
                    work_mode_str = "Hybrid"

                logo_el = await card.query_selector("img")
                logo_url = await logo_el.get_attribute("src") if logo_el else None

                meta = extract_meta(full_text or title)
                salary_str = salary_text or meta.get("salary_str")

                results.append(
                    JobListing(
                        title=title,
                        company=company,
                        url=full_url,
                        date_posted=(date_iso.isoformat() if date_iso else date_raw),
                        source=JobSource.glassdoor,
                        logo_url=logo_url,
                        location_str=location_str,
                        description_snippet=(full_text[:1500] if full_text else None),
                        salary_str=salary_str,
                        salary_src="structured" if salary_text else ("regex" if salary_str else None),
                        work_mode_str=work_mode_str,
                        work_mode_src="rule" if work_mode_str else None,
                        job_type_str=meta.get("job_type_str"),
                        job_type_src="rule" if meta.get("job_type_str") else None,
                        seniority_str=meta.get("seniority_str"),
                        seniority_src="rule" if meta.get("seniority_str") else None,
                        experience_str=primary_experience_value(meta.get("seniority_str"), meta.get("experience_years_str")),
                        experience_src="rule" if meta.get("seniority_str") or meta.get("experience_years_str") else None,
                    )
                )
            except Exception:
                continue

        if sort_by == "job-title-ascending":
            results.sort(key=lambda j: j.title.lower())
        elif sort_by == "job-title-descending":
            results.sort(key=lambda j: j.title.lower(), reverse=True)
        else:
            results.sort(key=lambda j: j.date_posted, reverse=True)

        log_scraper_done("glassdoor", query, len(results))
        return results
    except Exception as e:
        log_scraper_error("glassdoor", query, str(e))
        return []
    finally:
        try:
            if context:
                await context.close()
        except Exception:
            pass
