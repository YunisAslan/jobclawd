"""Jobgether scraper — backed by Jobicy public REST API (no auth required)."""

import asyncio
import re
from typing import Optional

import httpx

from models.schemas import JobListing, JobSource, LocationFilter
from scraper._common import (
    date_posted_cutoff,
    location_includes_remote,
    normalize_query,
    parse_iso_date,
)
from utils.job_meta_extractor import extract_all as extract_meta
from utils.job_meta_extractor import primary_experience_value


# Words that appear in almost every tech job title — not useful as search signals
_NOISE = frozenset({
    "developer", "engineer", "dev", "software", "job", "jobs",
    "senior", "junior", "lead", "mid", "staff", "principal",
    "manager", "specialist", "consultant", "analyst",
})


JOBICY_API = "https://jobicy.com/api/v2/remote-jobs"
JOBICY_BASE = "https://jobicy.com"

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "application/json",
}

# Map common query keywords to Jobicy industry slugs to fetch
_INDUSTRY_MAP = {
    "design": ["design"],
    "ux": ["design"],
    "ui": ["design"],
    "marketing": ["marketing"],
    "sales": ["sales"],
}
_DEFAULT_INDUSTRIES = ["engineering"]


def _jobicy_match(q: str, *texts: str) -> bool:
    """Stricter match for Jobicy: prefer specific tokens; fall back to any token only when
    all query tokens are noise words (e.g. pure 'software engineer' query)."""
    q_lower = q.lower().strip()
    if not q_lower:
        return True
    haystack = " ".join((t or "").lower() for t in texts)
    tokens = [t for t in re.split(r"[\s,/&\-+]+", q_lower) if len(t) >= 2]
    specific = [t for t in tokens if t not in _NOISE]
    # If there are specific tokens, ALL of them must appear (AND logic for precision)
    if specific:
        return all(tok in haystack for tok in specific[:2])
    # Pure noise query — fall back to OR matching on all tokens
    return any(tok in haystack for tok in tokens)


def _pick_industries(q: str) -> list[str]:
    q_lower = q.lower()
    for kw, inds in _INDUSTRY_MAP.items():
        if kw in q_lower:
            result = list(inds)
            if "engineering" not in result:
                result.append("engineering")
            return result
    return _DEFAULT_INDUSTRIES


async def _fetch_industry(client: httpx.AsyncClient, industry: str) -> list[dict]:
    try:
        resp = await client.get(JOBICY_API, params={"count": 100, "industry": industry})
        resp.raise_for_status()
        data = resp.json()
        return data.get("jobs", []) if isinstance(data, dict) else []
    except Exception:
        return []


async def scrape_jobgether(
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
    log_scraper_start("jobgether", query)
    try:
        q = normalize_query(query)
        cutoff = date_posted_cutoff(date_posted)
        industries = _pick_industries(q)

        raw_items: list[dict] = []
        seen_ids: set = set()

        async with httpx.AsyncClient(timeout=15.0, headers=_HEADERS) as client:
            pages = await asyncio.gather(*[_fetch_industry(client, ind) for ind in industries])

        for items in pages:
            for item in items:
                item_id = item.get("id") or item.get("jobSlug") or ""
                if item_id and item_id in seen_ids:
                    continue
                if item_id:
                    seen_ids.add(item_id)
                raw_items.append(item)

        results: list[JobListing] = []
        seen_urls: set[str] = set()

        for item in raw_items:
            try:
                title = (item.get("jobTitle") or "").strip()
                if not title:
                    continue

                company = (item.get("companyName") or "N/A").strip()
                url = (item.get("url") or
                       (f"{JOBICY_BASE}/jobs/{item['jobSlug']}" if item.get("jobSlug") else ""))
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)

                description = item.get("jobDescription") or item.get("jobExcerpt") or ""
                if not _jobicy_match(q, title, company, description):
                    continue

                date_raw = item.get("pubDate") or ""
                date_iso = parse_iso_date(date_raw)
                if cutoff and date_iso and date_iso < cutoff:
                    continue

                # Salary
                salary_str: Optional[str] = None
                s_min = item.get("minSalary")
                s_max = item.get("maxSalary")
                s_cur = item.get("currency") or "USD"
                sym = {"USD": "$", "EUR": "€", "GBP": "£"}.get(s_cur, s_cur + " ")
                if s_min and s_max:
                    salary_str = f"{sym}{int(s_min):,}–{sym}{int(s_max):,}"
                elif s_min:
                    salary_str = f"{sym}{int(s_min):,}+"

                # Job type
                jt_raw = (item.get("jobType") or [])
                if isinstance(jt_raw, list):
                    jt_raw = (jt_raw[0] if jt_raw else "")
                jt_lower = str(jt_raw).lower()
                if "full" in jt_lower:
                    job_type_str: Optional[str] = "Full-time"
                elif "part" in jt_lower:
                    job_type_str = "Part-time"
                elif "contract" in jt_lower or "freelance" in jt_lower:
                    job_type_str = "Contract"
                elif "intern" in jt_lower:
                    job_type_str = "Internship"
                else:
                    job_type_str = "Full-time"

                # Seniority
                seniority_raw = (item.get("jobLevel") or "").strip()
                if "senior" in seniority_raw.lower() or "sr." in seniority_raw.lower():
                    seniority_str: Optional[str] = "Senior"
                elif "junior" in seniority_raw.lower() or "entry" in seniority_raw.lower():
                    seniority_str = "Junior"
                elif "lead" in seniority_raw.lower() or "principal" in seniority_raw.lower():
                    seniority_str = "Lead"
                elif "intern" in seniority_raw.lower():
                    seniority_str = "Intern"
                elif "mid" in seniority_raw.lower() or "midweight" in seniority_raw.lower():
                    seniority_str = "Mid"
                else:
                    meta = extract_meta(title)
                    seniority_str = meta.get("seniority_str")

                location_str = item.get("jobGeo") or "Anywhere"

                results.append(JobListing(
                    title=title,
                    company=company,
                    url=url,
                    date_posted=(date_iso.isoformat() if date_iso else date_raw),
                    source=JobSource.jobgether,
                    logo_url=item.get("companyLogo") or None,
                    location_str=location_str,
                    description_snippet=(description[:1500] if description else None),
                    salary_str=salary_str,
                    salary_src="structured" if salary_str else None,
                    work_mode_str="Remote",
                    work_mode_src="structured",
                    job_type_str=job_type_str,
                    job_type_src="structured",
                    seniority_str=seniority_str,
                    seniority_src="rule" if seniority_str else None,
                    experience_str=primary_experience_value(seniority_str, None),
                    experience_src="rule" if seniority_str else None,
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

        if job_types:
            jt_wanted = {jt.lower() for jt in job_types}
            def _jt_match(j: JobListing) -> bool:
                if not j.job_type_str:
                    return True
                return j.job_type_str.lower().replace("-", "") in {jt.replace("-", "") for jt in jt_wanted}
            results = [j for j in results if _jt_match(j)]

        if sort_by == "job-title-ascending":
            results.sort(key=lambda j: j.title.lower())
        elif sort_by == "job-title-descending":
            results.sort(key=lambda j: j.title.lower(), reverse=True)
        else:
            results.sort(key=lambda j: j.date_posted, reverse=True)

        log_scraper_done("jobgether", query, len(results))
        return results

    except Exception as e:
        log_scraper_error("jobgether", query, str(e))
        return []
