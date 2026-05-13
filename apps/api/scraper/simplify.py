"""Simplify scraper — uses their public Typesense search API directly.

The simplify.jobs frontend talks to a Typesense cluster at js-ha.simplify.jobs
with a scoped, public search-only key. We replay that call from httpx — no
browser needed, ~1s per query.
"""

import json
import re
from typing import Optional

import httpx

from models.schemas import JobListing, JobSource, LocationFilter
from scraper._common import (
    basic_text_match,
    normalize_query,
    parse_iso_date,
    resolve_location_label,
)
from utils.job_meta_extractor import extract_all as extract_meta
from utils.job_meta_extractor import primary_experience_value


SIMPLIFY_BASE = "https://simplify.jobs"
TYPESENSE_URL = "https://js-ha.simplify.jobs/multi_search?use_cache=true"

# Scoped public search-only key embedded by simplify.jobs's frontend.
# The trailing JSON suffix (base64-encoded) restricts the response to the
# fields the public UI is allowed to read.
TYPESENSE_KEY = (
    "SWF1ODFZbzBkcVlVdnVwT2FqUE5EZ3JpSk5hVmdpUHg1SklXWEdGbHZVRT1POHJi"
    "eyJleGNsdWRlX2ZpZWxkcyI6ImNvbXBhbnlfdXJsLGNhdGVnb3JpZXMsYWRkaXRp"
    "b25hbF9yZXF1aXJlbWVudHMsY291bnRyaWVzLGRlZ3JlZXMsZ2VvbG9jYXRpb25z"
    "LGluZHVzdHJpZXMsaXNfc2ltcGxlX2FwcGxpY2F0aW9uLGpvYl9saXN0cyxsZWFk"
    "ZXJzaGlwX3R5cGUsc2VjdXJpdHlfY2xlYXJhbmNlLHNraWxscyx1cmwifQ=="
)

_HEADERS = {
    "accept": "application/json, text/plain, */*",
    "content-type": "text/plain",
    "origin": SIMPLIFY_BASE,
    "referer": f"{SIMPLIFY_BASE}/",
    "user-agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
    ),
    "x-typesense-api-key": TYPESENSE_KEY,
}


def _map_job_type(raw: str) -> Optional[str]:
    s = (raw or "").lower().replace(" ", "").replace("-", "").replace("_", "")
    if "full" in s:
        return "Full-time"
    if "part" in s:
        return "Part-time"
    if "intern" in s:
        return "Internship"
    if "contract" in s:
        return "Contract"
    return None


def _map_seniority(levels: list) -> Optional[str]:
    if not levels:
        return None
    txt = " ".join(str(x).lower() for x in levels)
    if "intern" in txt:
        return "Intern"
    if "entry" in txt or "junior" in txt:
        return "Junior"
    if "mid" in txt:
        return "Mid"
    if "senior" in txt or "expert" in txt:
        return "Senior"
    if "lead" in txt or "principal" in txt or "staff" in txt:
        return "Lead"
    return None


def _doc_to_job(doc: dict, q: str) -> Optional[JobListing]:
    title = (doc.get("title") or "").strip()
    posting_id = doc.get("posting_id") or doc.get("id") or ""
    if not title or not posting_id:
        return None

    company = (doc.get("company_name") or "N/A").strip()
    locations = doc.get("locations") or []
    location_str = ", ".join(str(l) for l in locations[:2]) if isinstance(locations, list) else str(locations or "")

    combined = f"{title} {company} {location_str}"
    if not basic_text_match(q, title, company, combined):
        return None

    url = f"{SIMPLIFY_BASE}/p/{posting_id}"
    job_type_str = _map_job_type(doc.get("type") or "") or "Full-time"

    levels = doc.get("experience_level") or []
    if not isinstance(levels, list):
        levels = [levels]
    seniority_str = _map_seniority(levels)

    lc_loc = location_str.lower()
    if "remote" in lc_loc:
        work_mode_str: Optional[str] = "Remote"
    elif "hybrid" in lc_loc:
        work_mode_str = "Hybrid"
    else:
        work_mode_str = None

    logo_url = doc.get("company_logo") or None
    updated = doc.get("updated_date")
    date_iso = ""
    if isinstance(updated, (int, float)) and updated > 0:
        import datetime as _dt
        try:
            date_iso = _dt.datetime.fromtimestamp(updated, tz=_dt.timezone.utc).isoformat()
        except Exception:
            date_iso = ""
    elif isinstance(updated, str):
        d = parse_iso_date(updated)
        date_iso = d.isoformat() if d else ""

    meta = extract_meta(combined or title)

    return JobListing(
        title=title,
        company=company,
        url=url,
        date_posted=date_iso,
        source=JobSource.simplify,
        logo_url=logo_url,
        location_str=location_str,
        description_snippet=None,
        salary_str=meta.get("salary_str"),
        salary_src="regex" if meta.get("salary_str") else None,
        work_mode_str=work_mode_str,
        work_mode_src="rule" if work_mode_str else None,
        job_type_str=job_type_str,
        job_type_src="structured",
        seniority_str=seniority_str,
        seniority_src="structured" if seniority_str else None,
        experience_str=primary_experience_value(seniority_str, meta.get("experience_years_str")),
        experience_src="rule" if seniority_str or meta.get("experience_years_str") else None,
    )


async def scrape_simplify(
    query: str,
    location: Optional[LocationFilter] = None,
    work_modes: Optional[list[str]] = None,
    experience: Optional[list[str]] = None,
    job_types: Optional[list[str]] = None,
    date_posted: Optional[str] = None,
    sort_by: Optional[str] = None,
) -> list[JobListing]:
    from services.admin_log_service import log_scraper_start, log_scraper_done, log_scraper_error

    log_scraper_start("simplify", query)
    try:
        q = normalize_query(query)
        loc_label = resolve_location_label(location)

        search: dict = {
            "collection": "jobs",
            "q": q or "*",
            "query_by": "title,company_name,functions,locations",
            "per_page": 50,
            "page": 1,
            "sort_by": "_text_match:desc,posting_id:desc",
        }

        filter_parts: list[str] = []
        if work_modes and "remote" in [w.lower() for w in work_modes]:
            filter_parts.append('locations:=[`Remote`]')
        if job_types:
            jt_map = {"full-time": "Full-Time", "part-time": "Part-Time",
                      "contract": "Contract", "internship": "Internship"}
            mapped = [jt_map[j.lower()] for j in job_types if j.lower() in jt_map]
            if mapped:
                quoted = ",".join(f"`{m}`" for m in mapped)
                filter_parts.append(f"type:=[{quoted}]")
        if filter_parts:
            search["filter_by"] = " && ".join(filter_parts)

        if loc_label:
            search["q"] = f"{q} {loc_label}".strip() if q else loc_label

        body = {"searches": [search]}

        async with httpx.AsyncClient(timeout=15.0, headers=_HEADERS) as client:
            resp = await client.post(TYPESENSE_URL, content=json.dumps(body))

        if resp.status_code != 200:
            log_scraper_done("simplify", query, 0)
            return []

        data = resp.json()
        results = (data.get("results") or [{}])[0]
        hits = results.get("hits") or []

        jobs: list[JobListing] = []
        seen: set[str] = set()
        for hit in hits:
            doc = hit.get("document") if isinstance(hit, dict) else None
            if not isinstance(doc, dict):
                continue
            job = _doc_to_job(doc, q)
            if not job or job.url in seen:
                continue
            seen.add(job.url)
            jobs.append(job)

        if sort_by == "job-title-ascending":
            jobs.sort(key=lambda j: j.title.lower())
        elif sort_by == "job-title-descending":
            jobs.sort(key=lambda j: j.title.lower(), reverse=True)
        else:
            jobs.sort(key=lambda j: j.date_posted, reverse=True)

        log_scraper_done("simplify", query, len(jobs))
        return jobs

    except Exception as e:
        log_scraper_error("simplify", query, str(e))
        return []
