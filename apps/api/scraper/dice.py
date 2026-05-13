"""Dice scraper — httpx + Next.js flight data parsing (no Playwright needed)."""

import json
import re
from typing import Optional
from urllib.parse import quote_plus

import httpx

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

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
}

_POSTED_MAP = {
    "1d": "ONE", "today": "ONE", "past-24h": "ONE",
    "3d": "THREE",
    "7d": "SEVEN", "past-week": "SEVEN",
}


def _decode_flight_chunks(html: str) -> str:
    """Decode all Next.js RSC flight chunks into a single searchable string."""
    chunks = re.findall(r'self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)', html)
    parts: list[str] = []
    for chunk in chunks:
        try:
            # chunk is a JSON-encoded string value; wrap in quotes to decode it
            parts.append(json.loads('"' + chunk + '"'))
        except Exception:
            parts.append(chunk)
    return "".join(parts)


def _extract_jobs(text: str) -> list[dict]:
    """Scan decoded flight data for JSON objects that contain 'detailsPageUrl'."""
    jobs: list[dict] = []
    seen_urls: set[str] = set()
    i = 0

    while i < len(text):
        idx = text.find('"detailsPageUrl"', i)
        if idx == -1:
            break

        # Walk backward to find the opening { of the containing object
        start = -1
        for k in range(idx - 1, max(-1, idx - 5000), -1):
            if text[k] == "{":
                start = k
                break

        if start == -1:
            i = idx + 1
            continue

        # Balanced-brace walk forward to find the matching }
        depth = 0
        j = start
        in_str = False
        limit = min(len(text), start + 10000)
        while j < limit:
            c = text[j]
            if in_str:
                if c == "\\":
                    j += 1  # skip escaped char
                elif c == '"':
                    in_str = False
            else:
                if c == '"':
                    in_str = True
                elif c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
                    if depth == 0:
                        break
            j += 1

        if depth == 0 and j < len(text):
            try:
                obj = json.loads(text[start : j + 1])
                if isinstance(obj, dict):
                    url = obj.get("detailsPageUrl", "")
                    if url and url not in seen_urls:
                        seen_urls.add(url)
                        jobs.append(obj)
            except Exception:
                pass

        i = idx + len('"detailsPageUrl"')

    return jobs


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
    try:
        q = normalize_query(query)
        loc_label = resolve_location_label(location)

        params = [f"q={quote_plus(q)}"]
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
                if j == "full-time":
                    jt_codes.append("FULLTIME")
                elif j == "part-time":
                    jt_codes.append("PARTTIME")
                elif j == "contract":
                    jt_codes.append("CONTRACTS")
                elif j == "internship":
                    jt_codes.append("INTERNSHIP")
            if jt_codes:
                params.append(f"filters.employmentType={'%7C'.join(jt_codes)}")

        url = f"{DICE_BASE}/jobs?{'&'.join(params)}"

        async with httpx.AsyncClient(
            timeout=20.0, headers=_HEADERS, follow_redirects=True
        ) as client:
            resp = await client.get(url)

        if resp.status_code != 200:
            log_scraper_done("dice", query, 0)
            return []

        flight_text = _decode_flight_chunks(resp.text)
        job_items = _extract_jobs(flight_text)

        cutoff = date_posted_cutoff(date_posted)
        results: list[JobListing] = []
        seen: set[str] = set()

        for item in job_items:
            try:
                title = (item.get("title") or item.get("position") or "").strip()
                if not title:
                    continue

                company = (
                    item.get("companyName")
                    or item.get("organizationName")
                    or item.get("company")
                    or "N/A"
                ).strip()

                job_url = item.get("detailsPageUrl") or ""
                if not job_url or job_url in seen:
                    continue
                if not job_url.startswith("http"):
                    job_url = f"{DICE_BASE}{job_url}"
                seen.add(job_url)

                # jobLocation is a dict with displayName
                loc_obj = item.get("jobLocation") or {}
                location_str = (
                    (loc_obj.get("displayName") if isinstance(loc_obj, dict) else str(loc_obj))
                    or item.get("location")
                    or ""
                )

                date_raw = item.get("postedDate") or item.get("datePosted") or ""
                date_iso = parse_iso_date(date_raw)
                if cutoff and date_iso and date_iso < cutoff:
                    continue

                # workplaceTypes is a list like ["Remote", "On-Site"]
                wpt = item.get("workplaceTypes") or []
                workplace_raw = "|".join(wpt).lower() if isinstance(wpt, list) else str(wpt).lower()
                is_remote = item.get("isRemote") or False
                if is_remote or "remote" in workplace_raw:
                    work_mode_str: Optional[str] = "Remote"
                elif "hybrid" in workplace_raw:
                    work_mode_str = "Hybrid"
                elif "on-site" in workplace_raw or "onsite" in workplace_raw:
                    work_mode_str = "On-site"
                else:
                    work_mode_str = None

                emp_raw = (item.get("employmentType") or "").lower()
                if "full" in emp_raw:
                    job_type_str: Optional[str] = "Full-time"
                elif "part" in emp_raw:
                    job_type_str = "Part-time"
                elif "contract" in emp_raw:
                    job_type_str = "Contract"
                elif "intern" in emp_raw:
                    job_type_str = "Internship"
                else:
                    job_type_str = None

                # salary is a plain string like "USD45 - USD63"
                salary_str: Optional[str] = None
                sal = item.get("salary")
                if isinstance(sal, str) and sal.strip():
                    salary_str = sal.strip()
                elif isinstance(sal, dict):
                    s_min = sal.get("min")
                    s_max = sal.get("max")
                    s_type = (sal.get("type") or "").lower()
                    if s_min and s_max:
                        period = "/yr" if "year" in s_type else ("/hr" if "hour" in s_type else "")
                        salary_str = f"${float(s_min):,.0f}–${float(s_max):,.0f}{period}"
                    elif s_min:
                        salary_str = f"${float(s_min):,.0f}+"

                description_snippet = item.get("summary") or item.get("description") or item.get("snippet") or ""
                if description_snippet:
                    description_snippet = re.sub(r"<[^>]+>", " ", description_snippet)[:1500]

                combined_text = f"{title} {company} {location_str} {description_snippet}"
                if not basic_text_match(q, title, company, combined_text):
                    continue

                logo_url = item.get("companyLogoUrl") or item.get("companyLogoUrlOptimized") or item.get("logoUrl") or None
                meta = extract_meta(combined_text or title)

                results.append(
                    JobListing(
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
                        experience_str=primary_experience_value(
                            meta.get("seniority_str"), meta.get("experience_years_str")
                        ),
                        experience_src=(
                            "rule"
                            if meta.get("seniority_str") or meta.get("experience_years_str")
                            else None
                        ),
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

        log_scraper_done("dice", query, len(results))
        return results

    except Exception as e:
        log_scraper_error("dice", query, str(e))
        return []
