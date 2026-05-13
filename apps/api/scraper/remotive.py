"""Remotive scraper — free public REST API, no auth required."""

import asyncio
import re
from typing import Optional

import httpx

from models.schemas import JobListing, JobSource, LocationFilter
from scraper._common import (
    basic_text_match,
    date_posted_cutoff,
    normalize_query,
    parse_iso_date,
)
from utils.job_meta_extractor import extract_all as extract_meta
from utils.job_meta_extractor import primary_experience_value


REMOTIVE_API = "https://remotive.com/api/remote-jobs"

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; JobBot/1.0)",
    "Accept": "application/json",
}

# Map common query keywords to Remotive categories
_CATEGORY_MAP = {
    "design": "design",
    "ux": "design",
    "ui": "design",
    "marketing": "marketing",
    "sales": "sales",
    "data": "data",
    "devops": "devops-sysadmin",
    "sysadmin": "devops-sysadmin",
    "finance": "finance-legal",
    "legal": "finance-legal",
    "product": "product",
    "qa": "qa",
    "testing": "qa",
    "support": "customer-support",
    "writing": "writing",
    "management": "management-finance",
}

_JOB_TYPE_MAP = {
    "full_time": "Full-time",
    "part_time": "Part-time",
    "contract": "Contract",
    "freelance": "Contract",
    "internship": "Internship",
}


def _pick_category(q: str) -> Optional[str]:
    q_lower = q.lower()
    for kw, cat in _CATEGORY_MAP.items():
        if kw in q_lower:
            return cat
    return "software-dev"


async def scrape_remotive(
    query: str,
    location: Optional[LocationFilter] = None,
    work_modes: Optional[list[str]] = None,
    experience: Optional[list[str]] = None,
    job_types: Optional[list[str]] = None,
    date_posted: Optional[str] = None,
    sort_by: Optional[str] = None,
) -> list[JobListing]:
    if work_modes and "remote" not in [w.lower() for w in work_modes]:
        return []

    from services.admin_log_service import log_scraper_start, log_scraper_done, log_scraper_error
    log_scraper_start("remotive", query)
    try:
        q = normalize_query(query)
        cutoff = date_posted_cutoff(date_posted)
        category = _pick_category(q)

        params: dict[str, str] = {"limit": "50"}
        if q:
            params["search"] = q
        if category:
            params["category"] = category

        async with httpx.AsyncClient(timeout=15.0, headers=_HEADERS) as client:
            resp = await client.get(REMOTIVE_API, params=params)
            resp.raise_for_status()
            data = resp.json()

        raw_jobs = data.get("jobs", []) if isinstance(data, dict) else []

        results: list[JobListing] = []
        seen_urls: set[str] = set()

        for item in raw_jobs:
            try:
                title = (item.get("title") or "").strip()
                if not title:
                    continue

                url = (item.get("url") or "").strip()
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)

                company = (item.get("company_name") or "N/A").strip()
                logo_url = item.get("company_logo") or item.get("company_logo_url") or None

                description = item.get("description") or ""
                if description:
                    description = re.sub(r"<[^>]+>", " ", description)[:1500]

                combined = f"{title} {company} {description}"
                if not basic_text_match(q, title, company, combined):
                    continue

                date_raw = item.get("publication_date") or ""
                date_iso = parse_iso_date(date_raw)
                if cutoff and date_iso and date_iso < cutoff:
                    continue

                jt_raw = (item.get("job_type") or "").lower()
                job_type_str = _JOB_TYPE_MAP.get(jt_raw)
                if not job_type_str:
                    if "full" in jt_raw:
                        job_type_str = "Full-time"
                    elif "part" in jt_raw:
                        job_type_str = "Part-time"
                    elif "contract" in jt_raw or "freelance" in jt_raw:
                        job_type_str = "Contract"

                # Apply job_types filter
                if job_types and job_type_str:
                    jt_wanted = {jt.lower().replace("-", "") for jt in job_types}
                    if (job_type_str or "").lower().replace("-", "") not in jt_wanted:
                        continue

                location_str = item.get("candidate_required_location") or "Worldwide"
                salary_str = item.get("salary") or None
                if isinstance(salary_str, str) and not salary_str.strip():
                    salary_str = None

                meta = extract_meta(combined or title)

                results.append(JobListing(
                    title=title,
                    company=company,
                    url=url,
                    date_posted=(date_iso.isoformat() if date_iso else date_raw),
                    source=JobSource.remotive,
                    logo_url=logo_url,
                    location_str=location_str,
                    description_snippet=(description[:1500] if description else None),
                    salary_str=salary_str or meta.get("salary_str"),
                    salary_src="structured" if salary_str else ("regex" if meta.get("salary_str") else None),
                    work_mode_str="Remote",
                    work_mode_src="structured",
                    job_type_str=job_type_str or meta.get("job_type_str"),
                    job_type_src="structured" if job_type_str else ("rule" if meta.get("job_type_str") else None),
                    seniority_str=meta.get("seniority_str"),
                    seniority_src="rule" if meta.get("seniority_str") else None,
                    experience_str=primary_experience_value(meta.get("seniority_str"), meta.get("experience_years_str")),
                    experience_src="rule" if meta.get("seniority_str") or meta.get("experience_years_str") else None,
                ))
            except Exception:
                continue

        if experience:
            wanted = {e.lower() for e in experience}
            def _exp_match(j: JobListing) -> bool:
                if not j.seniority_str:
                    return True
                s = j.seniority_str.lower()
                return any(w in s for w in wanted) or any(s in w for w in wanted)
            results = [j for j in results if _exp_match(j)]

        if sort_by == "job-title-ascending":
            results.sort(key=lambda j: j.title.lower())
        elif sort_by == "job-title-descending":
            results.sort(key=lambda j: j.title.lower(), reverse=True)
        else:
            results.sort(key=lambda j: j.date_posted, reverse=True)

        log_scraper_done("remotive", query, len(results))
        return results

    except Exception as e:
        log_scraper_error("remotive", query, str(e))
        return []
