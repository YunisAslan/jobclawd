"""Indeed job scraper — uses FlareSolverr to bypass CF + Indeed's anti-bot.

Strategy: Fetch the search page through FlareSolverr (which runs an undetected
Chrome), then parse the embedded mosaic JSON blob — it contains every field
we need (title, company, location, salary, date, job_type, etc.).
"""

import json
import re
from typing import Optional
from urllib.parse import quote_plus

from models.schemas import JobListing, JobSource, LocationFilter
from db.database import get_db
from scraper import _flaresolverr
from scraper._common import (
    basic_text_match,
    date_posted_cutoff,
    normalize_query,
    parse_iso_date,
    relative_to_iso,
)
from utils.job_meta_extractor import extract_all as extract_meta
from utils.job_meta_extractor import primary_experience_value


INDEED_BASE = "https://www.indeed.com"

# ── Mosaic JSON extraction ──────────────────────────────────────────
_MOSAIC_START_RE = re.compile(
    r'window\.mosaic\.providerData\["mosaic-provider-jobcards"\]\s*=\s*(\{)',
)

_JOBTYPE_MAP = {
    "fulltime": "Full-time",
    "full-time": "Full-time",
    "parttime": "Part-time",
    "part-time": "Part-time",
    "contract": "Contract",
    "temporary": "Temporary",
    "internship": "Internship",
    "commission": "Commission",
}

_EXPLVL_MAP = {
    "entry_level": "Junior",
    "mid_level": "Mid",
    "senior_level": "Senior",
}


def _taxonomy_attr_text(attr: dict) -> str:
    if not isinstance(attr, dict):
        return ""
    parts: list[str] = []
    label = attr.get("label")
    if isinstance(label, str) and label.strip():
        parts.append(label.strip())
    for item in attr.get("attributes") or []:
        if not isinstance(item, dict):
            continue
        value = item.get("label") or item.get("value")
        if isinstance(value, str) and value.strip():
            parts.append(value.strip())
    return " ".join(parts)


def _format_salary(item: dict) -> Optional[str]:
    sal = item.get("extractedSalary") or item.get("estimatedSalary") or {}
    if isinstance(sal, dict):
        s_min = sal.get("min")
        s_max = sal.get("max")
        s_type = (sal.get("type") or "").lower()
        period = "/yr" if "year" in s_type else ("/hr" if "hour" in s_type else ("/mo" if "month" in s_type else ""))
        if s_min and s_max:
            return f"${s_min:,.0f}-${s_max:,.0f}{period}"
        if s_min:
            return f"${s_min:,.0f}+"
    snippet = item.get("salarySnippet") or {}
    if isinstance(snippet, dict):
        text = snippet.get("text") or snippet.get("salaryTextFormatted")
        if isinstance(text, str) and text.strip():
            return text.strip()
    formatted = item.get("formattedSalary") or item.get("salary")
    if isinstance(formatted, str) and formatted.strip():
        return formatted.strip()
    return None


def _detect_job_type(item: dict, taxonomy: list) -> Optional[str]:
    raw = item.get("jobTypes") or []
    if isinstance(raw, list) and raw:
        jt = str(raw[0]).lower().replace("_", "").replace("-", "")
        for code, label in _JOBTYPE_MAP.items():
            if code.replace("-", "") in jt:
                return label
        return str(raw[0]).replace("_", " ").title()
    for attr in taxonomy:
        if not isinstance(attr, dict):
            continue
        label = (attr.get("label") or "").lower()
        if "job-type" in label or "jobtype" in label:
            attrs = attr.get("attributes") or []
            if attrs and isinstance(attrs[0], dict):
                val = attrs[0].get("label") or attrs[0].get("value") or ""
                if val:
                    norm = val.lower().replace("-", "").replace("_", "").replace(" ", "")
                    for code, lbl in _JOBTYPE_MAP.items():
                        if code.replace("-", "") in norm:
                            return lbl
                    return val.replace("_", " ").title()
    return None


def _detect_seniority(item: dict, taxonomy: list) -> Optional[str]:
    for attr in taxonomy:
        if not isinstance(attr, dict):
            continue
        label = (attr.get("label") or "").lower()
        if "experience" in label or "explvl" in label:
            attrs = attr.get("attributes") or []
            if attrs and isinstance(attrs[0], dict):
                val = (attrs[0].get("label") or attrs[0].get("value") or "").lower()
                for code, lbl in _EXPLVL_MAP.items():
                    if code in val.replace(" ", "_"):
                        return lbl
    return None


def _detect_work_mode(item: dict, taxonomy: list, location_str: str) -> Optional[str]:
    if item.get("remoteLocation"):
        return "Remote"
    if item.get("remoteWorkModel"):
        rwm = str(item.get("remoteWorkModel")).lower()
        if "remote" in rwm:
            return "Remote"
        if "hybrid" in rwm:
            return "Hybrid"
    for attr in taxonomy:
        if not isinstance(attr, dict):
            continue
        label = (attr.get("label") or "").lower()
        if "remote" in label or "work-from-home" in label or "wfh" in label:
            return "Remote"
        if "hybrid" in label:
            return "Hybrid"
    lc_loc = (location_str or "").lower()
    if "remote" in lc_loc:
        return "Remote"
    if "hybrid" in lc_loc:
        return "Hybrid"
    return None


def _parse_mosaic_to_jobs(html: str, q: str, cutoff) -> list[JobListing]:
    """Extract Indeed job listings directly from the mosaic JSON blob."""
    m = _MOSAIC_START_RE.search(html)
    if not m:
        return []
    try:
        blob, _ = json.JSONDecoder().raw_decode(html, m.start(1))
    except (json.JSONDecodeError, ValueError):
        return []

    try:
        results = blob["metaData"]["mosaicProviderJobCardsModel"]["results"]
    except (KeyError, TypeError):
        results = blob.get("results", []) if isinstance(blob, dict) else []

    if not isinstance(results, list):
        return []

    jobs: list[JobListing] = []
    seen_urls: set[str] = set()

    for item in results:
        if not isinstance(item, dict):
            continue
        try:
            jk = item.get("jobkey") or ""
            title = (item.get("displayTitle") or item.get("title") or "").strip()
            if not title or not jk:
                continue

            company = (item.get("company") or "N/A").strip()
            location_str = (item.get("formattedLocation") or "").strip()

            view_url = item.get("viewJobUrl") or item.get("link") or f"/viewjob?jk={jk}"
            if not view_url.startswith("http"):
                view_url = f"{INDEED_BASE}{view_url}"
            # Strip tracking params, keep just the jk-based URL for stability
            url = f"{INDEED_BASE}/viewjob?jk={jk}"
            if url in seen_urls:
                continue
            seen_urls.add(url)

            date_raw = item.get("formattedRelativeTime") or ""
            date_iso = relative_to_iso(date_raw)
            if cutoff and date_iso:
                d = parse_iso_date(date_iso)
                if d and d < cutoff:
                    continue

            taxonomy = item.get("taxonomyAttributes") or []
            salary_str = _format_salary(item)
            job_type_str = _detect_job_type(item, taxonomy)
            seniority_str = _detect_seniority(item, taxonomy)
            work_mode_str = _detect_work_mode(item, taxonomy, location_str)

            # Description snippet
            description = ""
            for key in ("snippet", "jobSnippet", "formattedSnippet", "description"):
                val = item.get(key)
                if isinstance(val, str) and val.strip():
                    description = re.sub(r"<[^>]+>", " ", val).strip()
                    break
                if isinstance(val, dict):
                    text = val.get("text") or val.get("html") or ""
                    if text:
                        description = re.sub(r"<[^>]+>", " ", text).strip()
                        break
            description = description[:1500] if description else ""

            combined_text = f"{title} {company} {location_str} {description}"
            if not basic_text_match(q, title, company, combined_text):
                continue

            # Logo
            logo_url = None
            branding = item.get("companyBrandingAttributes") or {}
            if isinstance(branding, dict):
                logo_url = branding.get("logoUrl") or branding.get("squareLogoUrl")

            # Regex fallback for missing fields
            meta = extract_meta(combined_text or title) if not all([salary_str, job_type_str, seniority_str, work_mode_str]) else {}

            jobs.append(JobListing(
                title=title,
                company=company,
                url=url,
                date_posted=(date_iso or date_raw),
                source=JobSource.indeed,
                logo_url=logo_url,
                location_str=location_str,
                description_snippet=description or None,
                salary_str=salary_str or meta.get("salary_str"),
                salary_src="structured" if salary_str else ("regex" if meta.get("salary_str") else None),
                work_mode_str=work_mode_str or meta.get("work_mode_str"),
                work_mode_src="structured" if work_mode_str else ("rule" if meta.get("work_mode_str") else None),
                job_type_str=job_type_str or meta.get("job_type_str"),
                job_type_src="structured" if job_type_str else ("rule" if meta.get("job_type_str") else None),
                seniority_str=seniority_str or meta.get("seniority_str"),
                seniority_src="structured" if seniority_str else ("rule" if meta.get("seniority_str") else None),
                experience_str=primary_experience_value(seniority_str or meta.get("seniority_str"), meta.get("experience_years_str")),
                experience_src="rule" if (seniority_str or meta.get("seniority_str") or meta.get("experience_years_str")) else None,
            ))
        except Exception:
            continue

    return jobs


def _build_search_url(query: str, location: Optional[LocationFilter], work_modes, experience, job_types, date_posted) -> str:
    encoded_q = quote_plus(query)
    target_location = ""

    if location and location.type in ("country", "city"):
        val = (location.values[0] if location.values else location.value) or ""
        if val:
            if location.type == "country":
                try:
                    with get_db() as conn:
                        row = conn.execute("SELECT name FROM countries WHERE code = %s", (val,)).fetchone()
                        if row:
                            target_location = row["name"]
                except Exception:
                    pass
            elif location.type == "city":
                try:
                    with get_db() as conn:
                        row = conn.execute("SELECT name FROM cities WHERE value = %s", (val,)).fetchone()
                        if row:
                            target_location = row["name"]
                        else:
                            target_location = val.split("-")[1].title() if "-" in val else val.title()
                except Exception:
                    target_location = val.split("-")[1].title() if "-" in val else val.title()

    fromage = 0
    if date_posted in ("1d", "today", "past-24h"):
        fromage = 1
    elif date_posted == "3d":
        fromage = 3
    elif date_posted in ("7d", "past-week"):
        fromage = 7
    elif date_posted in ("1m", "past-month"):
        fromage = 30

    sc_tags: list[str] = []
    if work_modes and "remote" in [w.lower() for w in work_modes]:
        sc_tags.append("attr(DSQF7)")
    if experience:
        exp_set = {e.lower() for e in experience}
        if exp_set & {"junior", "freshmen", "intern", "entry"}:
            sc_tags.append("explvl(ENTRY_LEVEL)")
        elif "mid" in exp_set:
            sc_tags.append("explvl(MID_LEVEL)")
        elif exp_set & {"senior", "lead"}:
            sc_tags.append("explvl(SENIOR_LEVEL)")
    if job_types:
        jt_set = {j.lower() for j in job_types}
        if "full-time" in jt_set:
            sc_tags.append("jobtype(fulltime)")
        elif "part-time" in jt_set:
            sc_tags.append("jobtype(parttime)")
        elif "internship" in jt_set:
            sc_tags.append("jobtype(internship)")

    url = f"{INDEED_BASE}/jobs?q={encoded_q}"
    if target_location:
        url += f"&l={quote_plus(target_location)}"
    if fromage > 0:
        url += f"&fromage={fromage}"
    if sc_tags:
        url += f"&sc=0kf:{''.join(t + ';' for t in sc_tags)}"
    url += "&sort=date"
    return url


async def scrape_indeed(
    query: str,
    location: Optional[LocationFilter] = None,
    work_modes: Optional[list[str]] = None,
    experience: Optional[list[str]] = None,
    job_types: Optional[list[str]] = None,
    date_posted: Optional[str] = None,
    sort_by: Optional[str] = None,
) -> list[JobListing]:
    from services.admin_log_service import log_scraper_start, log_scraper_done, log_scraper_error

    log_scraper_start("indeed", query)

    if not _flaresolverr.is_enabled():
        # Indeed is unscrapeable from data center / headless browsers without
        # CF bypass; without FlareSolverr we return [] cleanly.
        log_scraper_done("indeed", query, 0)
        return []

    try:
        q = normalize_query(query)
        cutoff = date_posted_cutoff(date_posted)
        url = _build_search_url(q, location, work_modes, experience, job_types, date_posted)

        all_jobs: list[JobListing] = []
        seen_urls: set[str] = set()

        # Paginate 3 pages (Indeed shows ~15 jobs/page, so ~45 max)
        for offset in (0, 10, 20):
            page_url = f"{url}&start={offset}" if offset else url
            html = await _flaresolverr.fetch_html(page_url, max_timeout=60000)
            if not html:
                break
            page_jobs = _parse_mosaic_to_jobs(html, q, cutoff)
            if not page_jobs:
                break
            for j in page_jobs:
                if j.url in seen_urls:
                    continue
                seen_urls.add(j.url)
                all_jobs.append(j)

        if sort_by == "job-title-ascending":
            all_jobs.sort(key=lambda j: j.title.lower())
        elif sort_by == "job-title-descending":
            all_jobs.sort(key=lambda j: j.title.lower(), reverse=True)
        else:
            all_jobs.sort(key=lambda j: j.date_posted, reverse=True)

        log_scraper_done("indeed", query, len(all_jobs))
        return all_jobs

    except Exception as e:
        log_scraper_error("indeed", query, str(e))
        return []
