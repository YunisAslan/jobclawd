"""RemoteOK scraper — uses the public tag-filtered JSON API (no Playwright needed)."""

import re
from typing import Optional

import httpx

from models.schemas import JobListing, JobSource, LocationFilter
from scraper._common import (
    basic_text_match,
    date_posted_cutoff,
    location_includes_remote,
    normalize_query,
    parse_iso_date,
)
from utils.job_meta_extractor import extract_all as extract_meta
from utils.job_meta_extractor import primary_experience_value


REMOTEOK_BASE = "https://remoteok.com"
REMOTEOK_API = "https://remoteok.com/api"

_GENERIC = {"developer", "engineer", "dev", "job", "jobs", "remote",
            "senior", "junior", "lead", "mid", "staff", "principal"}

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "application/json",
}


def _query_to_tags(q: str) -> list[str]:
    tokens = [t for t in re.split(r"[\s,/&\-+]+", q.lower()) if len(t) >= 2]
    specific = [t for t in tokens if t not in _GENERIC]
    result = specific[:3] if specific else tokens[:2]
    return result or ["developer"]


async def scrape_remoteok(
    query: str,
    location: Optional[LocationFilter] = None,
    work_modes: Optional[list[str]] = None,
    experience: Optional[list[str]] = None,
    job_types: Optional[list[str]] = None,
    date_posted: Optional[str] = None,
    sort_by: Optional[str] = None,
) -> list[JobListing]:
    if not location_includes_remote(location):
        return []
    if work_modes and "remote" not in [w.lower() for w in work_modes]:
        return []

    from services.admin_log_service import log_scraper_start, log_scraper_done, log_scraper_error
    log_scraper_start("remoteok", query)
    try:
        q = normalize_query(query)
        tags = _query_to_tags(q)
        cutoff = date_posted_cutoff(date_posted)

        raw_items: list[dict] = []
        seen_ids: set[str] = set()

        async with httpx.AsyncClient(timeout=15.0, headers=_HEADERS) as client:
            for tag in tags:
                try:
                    resp = await client.get(REMOTEOK_API, params={"tag": tag})
                    resp.raise_for_status()
                    data = resp.json()
                    for item in data:
                        if not isinstance(item, dict) or not item.get("position"):
                            continue
                        item_id = str(item.get("id") or item.get("slug") or "")
                        if item_id and item_id in seen_ids:
                            continue
                        if item_id:
                            seen_ids.add(item_id)
                        raw_items.append(item)
                except Exception:
                    continue

        results: list[JobListing] = []

        for item in raw_items:
            try:
                title = (item.get("position") or "").strip()
                if not title:
                    continue

                company = (item.get("company") or "").strip() or "N/A"
                slug = item.get("slug") or item.get("id") or ""
                url = item.get("url") or (f"{REMOTEOK_BASE}/remote-jobs/{slug}" if slug else "")
                if not url:
                    continue

                tags_list = [str(t).strip() for t in (item.get("tags") or []) if t]
                description = item.get("description") or ""
                location_str = (item.get("location") or "Remote").strip() or "Remote"

                if not basic_text_match(q, title, " ".join(tags_list), description, company):
                    continue

                posted = item.get("date") or item.get("epoch")
                posted_dt = parse_iso_date(posted)
                if cutoff and posted_dt and posted_dt < cutoff:
                    continue

                salary_min = item.get("salary_min")
                salary_max = item.get("salary_max")
                salary_str: Optional[str] = None
                if salary_min and salary_max:
                    salary_str = f"${int(salary_min):,}–${int(salary_max):,}"
                elif salary_min:
                    salary_str = f"${int(salary_min):,}+"
                else:
                    meta = extract_meta(f"{title} {description}")
                    salary_str = meta.get("salary_str")

                seniority_str = None
                for tag in tags_list:
                    lt = tag.lower()
                    if "senior" in lt or "sr." in lt:
                        seniority_str = "Senior"
                        break
                    if "junior" in lt or "jr." in lt:
                        seniority_str = "Junior"
                        break
                    if "lead" in lt or "principal" in lt or "staff" in lt:
                        seniority_str = "Lead"
                        break
                    if "intern" in lt:
                        seniority_str = "Intern"
                        break
                if not seniority_str:
                    seniority_str = extract_meta(title).get("seniority_str")

                primary_exp = primary_experience_value(seniority_str, None)
                logo_url = item.get("company_logo") or item.get("logo")

                results.append(JobListing(
                    title=title,
                    company=company,
                    url=url,
                    date_posted=(posted_dt.isoformat() if posted_dt else (str(posted) if posted else "")),
                    source=JobSource.remoteok,
                    logo_url=logo_url,
                    location_str=location_str,
                    description_snippet=(description[:1500] if description else None),
                    salary_str=salary_str,
                    salary_src="structured" if (salary_min or salary_max) else ("regex" if salary_str else None),
                    work_mode_str="Remote",
                    work_mode_src="structured",
                    job_type_str="Full-time",
                    job_type_src="default",
                    seniority_str=seniority_str,
                    seniority_src="rule" if seniority_str else None,
                    experience_str=primary_exp,
                    experience_src="rule" if primary_exp else None,
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

        log_scraper_done("remoteok", query, len(results))
        return results

    except Exception as e:
        log_scraper_error("remoteok", query, str(e))
        return []
