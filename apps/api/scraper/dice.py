"""Dice scraper — Playwright + network interception of their internal job search API."""

import re
from typing import Optional
from urllib.parse import quote_plus

from playwright_stealth import Stealth
from scraper import get_browser
from models.schemas import JobListing, JobSource, LocationFilter
from scraper._common import (
    basic_text_match,
    date_posted_cutoff,
    normalize_query,
    parse_iso_date,
    resolve_location_label,
)
from utils.job_meta_extractor import extract_all as extract_meta
from utils.job_meta_extractor import primary_experience_value


DICE_BASE = "https://www.dice.com"

_POSTED_MAP = {
    "1d": "ONE", "today": "ONE", "past-24h": "ONE",
    "3d": "THREE",
    "7d": "SEVEN", "past-week": "SEVEN",
}


async def scrape_dice(
    query: str,
    location: Optional[LocationFilter] = None,
    work_modes: Optional[list[str]] = None,
    experience: Optional[list[str]] = None,
    job_types: Optional[list[str]] = None,
    date_posted: Optional[str] = None,
    sort_by: Optional[str] = None,
) -> list[JobListing]:
    from services.admin_log_service import log_scraper_start, log_scraper_done, log_scraper_error
    log_scraper_start("dice", query)
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
        page = await context.new_page()
        await Stealth().apply_stealth_async(page)

        q = normalize_query(query)

        params = [f"q={quote_plus(q)}"]
        loc_label = resolve_location_label(location)
        if loc_label:
            params.append(f"location={quote_plus(loc_label)}")
        if date_posted in _POSTED_MAP:
            params.append(f"filters.postedDate={_POSTED_MAP[date_posted]}")
        if work_modes and "remote" in [w.lower() for w in work_modes]:
            params.append("filters.workplaceTypes=Remote")
        if job_types:
            jt_codes: list[str] = []
            for jt in job_types:
                j = jt.lower()
                if j == "full-time":    jt_codes.append("FULLTIME")
                elif j == "part-time":  jt_codes.append("PARTTIME")
                elif j == "contract":   jt_codes.append("CONTRACTS")
                elif j == "internship": jt_codes.append("INTERNSHIP")
            if jt_codes:
                params.append(f"filters.employmentType={'%7C'.join(jt_codes)}")

        url = f"{DICE_BASE}/jobs?{'&'.join(params)}"

        # Intercept Dice's internal job search API responses (browser sends cookies auto)
        captured_jobs: list[dict] = []

        async def handle_response(response):
            try:
                if response.status != 200:
                    return
                ct = response.headers.get("content-type", "")
                if "json" not in ct:
                    return
                data = await response.json()
                if not isinstance(data, dict):
                    return
                for key in ("data", "results", "jobs", "hits", "jobResults"):
                    val = data.get(key)
                    if isinstance(val, list) and len(val) >= 1 and isinstance(val[0], dict):
                        if any(k in val[0] for k in ("title", "position", "name", "jobTitle")):
                            captured_jobs.extend(val)
                            break
            except Exception:
                pass

        page.on("response", handle_response)

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=25000)
            await page.wait_for_timeout(10000)
        except Exception:
            log_scraper_done("dice", query, 0)
            return []

        # CF detection — bail early if challenge page is shown
        page_title = (await page.title()).lower()
        if any(kw in page_title for kw in ("just a moment", "cloudflare", "checking your", "verify")):
            log_scraper_done("dice", query, 0)
            return []

        cutoff = date_posted_cutoff(date_posted)
        results: list[JobListing] = []
        seen: set[str] = set()

        for item in captured_jobs:
            if not isinstance(item, dict):
                continue
            try:
                title = (item.get("title") or item.get("position") or "").strip()
                if not title:
                    continue

                company = (
                    item.get("organizationName") or
                    item.get("company") or
                    item.get("employer") or
                    "N/A"
                ).strip()

                job_id = item.get("id") or item.get("jobId") or ""
                job_url = (
                    item.get("applyUrl") or
                    item.get("detailsPageUrl") or
                    item.get("url") or
                    (f"{DICE_BASE}/job-detail/{job_id}" if job_id else "")
                )
                if not job_url or job_url in seen:
                    continue
                if not job_url.startswith("http"):
                    job_url = f"{DICE_BASE}{job_url}"
                seen.add(job_url)

                location_str = (
                    item.get("location") or
                    item.get("locationName") or
                    ", ".join(item.get("locations") or []) or
                    ""
                )

                date_raw = item.get("postedDate") or item.get("datePosted") or ""
                date_iso = parse_iso_date(date_raw)
                if cutoff and date_iso and date_iso < cutoff:
                    continue

                workplace_raw = (
                    item.get("workplaceType") or
                    "|".join(item.get("workplaceTypes") or []) or
                    ""
                ).lower()
                if "remote" in workplace_raw:
                    work_mode_str: Optional[str] = "Remote"
                elif "hybrid" in workplace_raw:
                    work_mode_str = "Hybrid"
                elif "on-site" in workplace_raw or "onsite" in workplace_raw:
                    work_mode_str = "On-site"
                else:
                    work_mode_str = None

                emp_raw = (
                    item.get("employmentType") or
                    "|".join(item.get("employmentTypes") or []) or
                    ""
                ).upper()
                if "FULLTIME" in emp_raw or "FULL_TIME" in emp_raw:
                    job_type_str: Optional[str] = "Full-time"
                elif "PARTTIME" in emp_raw or "PART_TIME" in emp_raw:
                    job_type_str = "Part-time"
                elif "CONTRACT" in emp_raw:
                    job_type_str = "Contract"
                elif "INTERN" in emp_raw:
                    job_type_str = "Internship"
                else:
                    job_type_str = None

                salary_str: Optional[str] = None
                sal = item.get("salary") or {}
                if isinstance(sal, dict):
                    s_min = sal.get("min")
                    s_max = sal.get("max")
                    s_type = (sal.get("type") or "").lower()
                    if s_min and s_max:
                        period = "/yr" if "year" in s_type else ("/hr" if "hour" in s_type else "")
                        salary_str = f"${float(s_min):,.0f}–${float(s_max):,.0f}{period}"
                    elif s_min:
                        salary_str = f"${float(s_min):,.0f}+"
                if not salary_str:
                    salary_str = item.get("salaryText") or item.get("formattedSalary") or None

                description_snippet = (
                    item.get("description") or
                    item.get("descriptionHtml") or
                    item.get("snippet") or
                    ""
                )
                if description_snippet:
                    description_snippet = re.sub(r"<[^>]+>", " ", description_snippet)[:1500]

                combined_text = f"{title} {company} {location_str} {description_snippet}"
                if not basic_text_match(q, title, company, combined_text):
                    continue

                logo_url = item.get("companyLogoUrl") or item.get("logoUrl") or None
                meta = extract_meta(combined_text or title)

                results.append(JobListing(
                    title=title,
                    company=company,
                    url=job_url,
                    date_posted=(date_iso.isoformat() if date_iso else date_raw),
                    source=JobSource.dice,
                    logo_url=logo_url,
                    location_str=location_str,
                    description_snippet=description_snippet or None,
                    salary_str=salary_str or meta.get("salary_str"),
                    salary_src="structured" if salary_str else ("regex" if meta.get("salary_str") else None),
                    work_mode_str=work_mode_str or meta.get("work_mode_str"),
                    work_mode_src="structured" if work_mode_str else ("rule" if meta.get("work_mode_str") else None),
                    job_type_str=job_type_str or meta.get("job_type_str"),
                    job_type_src="structured" if job_type_str else ("rule" if meta.get("job_type_str") else None),
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

        log_scraper_done("dice", query, len(results))
        return results

    except Exception as e:
        log_scraper_error("dice", query, str(e))
        return []
    finally:
        try:
            if context:
                await context.close()
        except Exception:
            pass
