"""ZipRecruiter scraper — uses FlareSolverr to bypass Cloudflare Bot Management.

Strategy: Fetch the search page through FlareSolverr, then parse the embedded
JSON-LD ItemList (20 jobs per page). Company / location are extracted from the
structured URL pattern: /c/{Company}/Job/{Title}/-in-{Loc}?jid={id}
"""

import json
import re
from typing import Optional
from urllib.parse import quote_plus, unquote, urlparse

from models.schemas import JobListing, JobSource, LocationFilter
from scraper import _flaresolverr
from scraper._common import (
    basic_text_match,
    normalize_query,
    resolve_location_label,
)
from utils.job_meta_extractor import extract_all as extract_meta
from utils.job_meta_extractor import primary_experience_value


ZIP_BASE = "https://www.ziprecruiter.com"

_JSON_LD_RE = re.compile(
    r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.S | re.I,
)

# /c/{COMPANY}/Job/{TITLE}/-in-{LOCATION}?jid={ID}
_URL_RE = re.compile(
    r"/c/([^/]+)/Job/([^/?]+)(?:/-in-([^/?]+))?"
)


def _parse_url_meta(url: str) -> dict:
    """Extract company / location / jid from a ZipRecruiter job URL."""
    try:
        parsed = urlparse(url)
        m = _URL_RE.search(parsed.path)
        if not m:
            return {}
        company_slug, _title_slug, loc_slug = m.groups()
        company = unquote(company_slug or "").replace("-", " ").strip()
        location = unquote(loc_slug or "").replace("-", " ").strip() if loc_slug else ""
        return {"company": company, "location": location}
    except Exception:
        return {}


def _parse_jsonld_jobs(html: str) -> list[dict]:
    """Find the ItemList block of jobs in the page's JSON-LD scripts."""
    jobs: list[dict] = []
    for block in _JSON_LD_RE.findall(html):
        try:
            data = json.loads(block.strip())
        except Exception:
            continue
        if isinstance(data, dict) and data.get("@type") == "ItemList":
            for item in data.get("itemListElement", []) or []:
                if isinstance(item, dict) and item.get("name") and item.get("url"):
                    jobs.append(item)
        elif isinstance(data, dict) and data.get("@type") == "JobPosting":
            jobs.append({"name": data.get("title", ""), "url": data.get("url", "")})
    return jobs


async def scrape_ziprecruiter(
    query: str,
    location: Optional[LocationFilter] = None,
    work_modes: Optional[list[str]] = None,
    experience: Optional[list[str]] = None,
    job_types: Optional[list[str]] = None,
    date_posted: Optional[str] = None,
    sort_by: Optional[str] = None,
) -> list[JobListing]:
    from services.admin_log_service import log_scraper_start, log_scraper_done, log_scraper_error

    log_scraper_start("ziprecruiter", query)

    if not _flaresolverr.is_enabled():
        log_scraper_done("ziprecruiter", query, 0)
        return []

    try:
        q = normalize_query(query)
        loc_label = resolve_location_label(location) or "United States"

        params = [f"search={quote_plus(q)}", f"location={quote_plus(loc_label)}"]
        if date_posted in ("1d", "today", "past-24h"):
            params.append("days=1")
        elif date_posted == "3d":
            params.append("days=3")
        elif date_posted in ("7d", "past-week"):
            params.append("days=5")
        elif date_posted in ("1m", "past-month"):
            params.append("days=10")
        if work_modes and "remote" in [w.lower() for w in work_modes]:
            params.append("refine_by_location_type=only_remote")

        url = f"{ZIP_BASE}/jobs-search?{'&'.join(params)}"
        html = await _flaresolverr.fetch_html(url, max_timeout=60000)
        if not html:
            log_scraper_done("ziprecruiter", query, 0)
            return []

        raw_jobs = _parse_jsonld_jobs(html)
        if not raw_jobs:
            log_scraper_done("ziprecruiter", query, 0)
            return []

        results: list[JobListing] = []
        seen: set[str] = set()

        for item in raw_jobs:
            try:
                title = (item.get("name") or "").strip()
                job_url = (item.get("url") or "").strip()
                if not title or not job_url or job_url in seen:
                    continue
                seen.add(job_url)

                meta = _parse_url_meta(job_url)
                company = meta.get("company") or "N/A"
                location_str = meta.get("location") or ""

                lc_all = f"{title} {location_str}".lower()
                if "remote" in lc_all:
                    work_mode_str: Optional[str] = "Remote"
                    if not location_str:
                        location_str = "Remote"
                elif "hybrid" in lc_all:
                    work_mode_str = "Hybrid"
                else:
                    work_mode_str = None

                combined = f"{title} {company} {location_str}"
                if not basic_text_match(q, title, company, combined):
                    continue

                text_meta = extract_meta(combined)

                results.append(JobListing(
                    title=title,
                    company=company,
                    url=job_url,
                    date_posted="",
                    source=JobSource.ziprecruiter,
                    logo_url=None,
                    location_str=location_str,
                    description_snippet=None,
                    salary_str=text_meta.get("salary_str"),
                    salary_src="regex" if text_meta.get("salary_str") else None,
                    work_mode_str=work_mode_str or text_meta.get("work_mode_str"),
                    work_mode_src="rule" if (work_mode_str or text_meta.get("work_mode_str")) else None,
                    job_type_str=text_meta.get("job_type_str"),
                    job_type_src="rule" if text_meta.get("job_type_str") else None,
                    seniority_str=text_meta.get("seniority_str"),
                    seniority_src="rule" if text_meta.get("seniority_str") else None,
                    experience_str=primary_experience_value(text_meta.get("seniority_str"), text_meta.get("experience_years_str")),
                    experience_src="rule" if text_meta.get("seniority_str") or text_meta.get("experience_years_str") else None,
                ))
            except Exception:
                continue

        if job_types:
            jt_set = {jt.lower().replace("-", "") for jt in job_types}
            results = [
                j for j in results
                if not j.job_type_str or j.job_type_str.lower().replace("-", "") in jt_set
            ]

        if sort_by == "job-title-ascending":
            results.sort(key=lambda j: j.title.lower())
        elif sort_by == "job-title-descending":
            results.sort(key=lambda j: j.title.lower(), reverse=True)

        log_scraper_done("ziprecruiter", query, len(results))
        return results

    except Exception as e:
        log_scraper_error("ziprecruiter", query, str(e))
        return []
