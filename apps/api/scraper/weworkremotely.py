"""We Work Remotely scraper — uses public category RSS feeds (no Playwright needed)."""

import asyncio
import re
from email.utils import parsedate_to_datetime
from typing import Optional

import httpx

from models.schemas import JobListing, JobSource, LocationFilter
from scraper._common import (
    basic_text_match,
    date_posted_cutoff,
    location_includes_remote,
    normalize_query,
)
from utils.job_meta_extractor import extract_all as extract_meta
from utils.job_meta_extractor import primary_experience_value


WWR_BASE = "https://weworkremotely.com"

_CATEGORY_FEEDS = [
    "/categories/remote-programming-jobs.rss",
    "/categories/remote-front-end-programming-jobs.rss",
    "/categories/remote-back-end-programming-jobs.rss",
    "/categories/remote-full-stack-programming-jobs.rss",
    "/categories/remote-devops-sysadmin-jobs.rss",
    "/categories/remote-design-jobs.rss",
    "/categories/remote-product-jobs.rss",
    "/categories/remote-marketing-jobs.rss",
    "/categories/remote-sales-and-business-development-jobs.rss",
    "/categories/remote-customer-support-jobs.rss",
]

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
}

_CHANNEL_TITLES = {
    "we work remotely",
    "we work remotely: remote jobs",
    "weworkremotely.com",
}


def _strip_cdata(s: str) -> str:
    m = re.match(r'\s*<!\[CDATA\[(.*?)\]\]>\s*$', s, re.DOTALL)
    return m.group(1).strip() if m else s.strip()


def _parse_feed(body: str) -> list[dict]:
    items = []
    for chunk in re.split(r'<item[^>]*>', body)[1:]:
        chunk = chunk.split("</item>")[0] if "</item>" in chunk else chunk

        title_m = re.search(r"<title>(.*?)</title>", chunk, re.DOTALL)
        if not title_m:
            continue
        raw_title = _strip_cdata(title_m.group(1))
        if not raw_title or raw_title.lower() in _CHANNEL_TITLES:
            continue

        # WWR title format: "Company: Job Title"
        if ": " in raw_title:
            company, title = raw_title.split(": ", 1)
        else:
            company, title = "N/A", raw_title

        title = title.strip()
        company = company.strip() or "N/A"
        if not title:
            continue

        # <link> appears after the first self-closing </link> in RSS 2.0
        link_m = re.search(r"<link>(https?://[^<\s]+)</link>", chunk)
        if not link_m:
            link_m = re.search(r"<link><!\[CDATA\[(https?://[^\]]+)\]\]>", chunk)
        url = link_m.group(1).strip() if link_m else ""
        if not url:
            continue

        region_m = re.search(r"<region>(.*?)</region>", chunk, re.DOTALL)
        region = _strip_cdata(region_m.group(1)) if region_m else "Remote"

        pub_m = re.search(r"<pubDate>(.*?)</pubDate>", chunk, re.DOTALL)
        date_aware = None
        if pub_m:
            try:
                date_aware = parsedate_to_datetime(pub_m.group(1).strip())
            except Exception:
                pass

        items.append({
            "title": title,
            "company": company,
            "url": url,
            "region": region or "Remote",
            "date_aware": date_aware,
        })
    return items


async def _fetch_feed(client: httpx.AsyncClient, path: str) -> Optional[str]:
    try:
        resp = await client.get(f"{WWR_BASE}{path}")
        resp.raise_for_status()
        return resp.text
    except Exception:
        return None


async def scrape_weworkremotely(
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
    log_scraper_start("weworkremotely", query)
    try:
        q = normalize_query(query)
        cutoff = date_posted_cutoff(date_posted)

        raw_items: list[dict] = []
        seen_urls: set[str] = set()

        async with httpx.AsyncClient(timeout=15.0, headers=_HEADERS, follow_redirects=True) as client:
            bodies = await asyncio.gather(
                *[_fetch_feed(client, path) for path in _CATEGORY_FEEDS]
            )

        for body in bodies:
            if not body:
                continue
            for item in _parse_feed(body):
                if item["url"] not in seen_urls:
                    seen_urls.add(item["url"])
                    raw_items.append(item)

        results: list[JobListing] = []

        for item in raw_items:
            try:
                title = item["title"]
                company = item["company"]
                url = item["url"]
                date_aware = item["date_aware"]

                if not basic_text_match(q, title, company, f"{title} {company}"):
                    continue

                if cutoff and date_aware and date_aware < cutoff:
                    continue

                meta = extract_meta(f"{title} {company}")
                date_str = date_aware.isoformat() if date_aware else ""

                results.append(JobListing(
                    title=title,
                    company=company,
                    url=url,
                    date_posted=date_str,
                    source=JobSource.weworkremotely,
                    logo_url=None,
                    location_str=item["region"],
                    description_snippet=None,
                    salary_str=meta.get("salary_str"),
                    salary_src="regex" if meta.get("salary_str") else None,
                    work_mode_str="Remote",
                    work_mode_src="structured",
                    job_type_str=meta.get("job_type_str") or "Full-time",
                    job_type_src="rule" if meta.get("job_type_str") else "default",
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

        log_scraper_done("weworkremotely", query, len(results))
        return results

    except Exception as e:
        log_scraper_error("weworkremotely", query, str(e))
        return []
