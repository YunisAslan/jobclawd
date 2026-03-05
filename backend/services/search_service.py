"""
Service: orchestrates multi-source scraping, scoring, and result filtering.
Contains the business logic that was previously mixed into the router.
"""
import asyncio
from typing import Optional

from models.schemas import JobSource, SearchResponse, LocationFilter
from scraper.search import scrape_search
from scraper.linkedin import scrape_linkedin
from scraper.indeed import scrape_indeed
from db.database import get_db


async def run_search(
    query: str,
    sources: list[JobSource],
    location: Optional[LocationFilter] = None,
    work_modes: Optional[list[str]] = None,
    experience: Optional[list[str]] = None,
    job_types: Optional[list[str]] = None,
    date_posted: Optional[str] = None,
    salary_min: Optional[str] = None,
    sort_by: Optional[str] = None,
) -> SearchResponse:
    """Fan out scrapers per selected location in parallel, merge, deduplicate, then AI filter."""

    # --- Expand multi-value location into individual per-country LocationFilters ---
    # When user selects e.g. [AZ, TR], we run scrapers once per country so each
    # gets a proper single-location URL, then merge all results before AI filtering.
    location_shards: list[Optional[LocationFilter]] = []

    if location and location.values and len(location.values) > 1:
        for val in location.values:
            location_shards.append(LocationFilter(type=location.type, value=val, values=[val]))
    else:
        location_shards.append(location)

    # Resolve currency from first shard
    currency = "USD"
    first_loc = location_shards[0] if location_shards else None
    if first_loc and first_loc.type in ["country", "city"]:
        country_code: Optional[str] = None
        if first_loc.type == "country":
            country_code = first_loc.value or (first_loc.values[0] if first_loc.values else None)
        elif first_loc.type == "city" and first_loc.values:
            with get_db() as conn:
                row = conn.execute(
                    "SELECT country_code FROM cities WHERE value = ?", (first_loc.values[0],)
                ).fetchone()
                if row:
                    country_code = row["country_code"]
        if country_code:
            with get_db() as conn:
                row = conn.execute(
                    "SELECT currency FROM countries WHERE code = ?", (country_code,)
                ).fetchone()
                if row:
                    currency = row["currency"]

    # --- Build scraper tasks, one set per location shard ---
    tasks = []
    for shard in location_shards:
        shard_country = None
        if shard and shard.type == "country":
            shard_country = shard.value or (shard.values[0] if shard.values else None)
        elif shard and shard.type == "city" and shard.values:
            with get_db() as conn:
                row = conn.execute(
                    "SELECT country_code FROM cities WHERE value = ?", (shard.values[0],)
                ).fetchone()
                if row:
                    shard_country = row["country_code"]

        if JobSource.jobsearch in sources:
            # Only fire jobsearch.az for AZ or when country is unspecified
            if not shard_country or shard_country.lower() == "az":
                tasks.append(scrape_search(
                    query, shard,
                    work_modes=work_modes,
                    experience=experience,
                    job_types=job_types,
                    date_posted=date_posted,
                    sort_by=sort_by,
                ))

        if JobSource.linkedin in sources:
            tasks.append(scrape_linkedin(query, shard, work_modes=work_modes, experience=experience, job_types=job_types, date_posted=date_posted, sort_by=sort_by))
        if JobSource.indeed in sources:
            tasks.append(scrape_indeed(query, shard, work_modes=work_modes, experience=experience, job_types=job_types, date_posted=date_posted, sort_by=sort_by))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Merge all results and deduplicate by URL
    seen_urls: set[str] = set()
    all_jobs: list[JobListing] = []
    for result in results:
        if isinstance(result, Exception):
            print(f"Scraper error: {result}")
            continue
        if isinstance(result, list):
            for job in result:
                if job.url not in seen_urls:
                    seen_urls.add(job.url)
                    all_jobs.append(job)

    print(f"[Search] Total unique jobs after merge: {len(all_jobs)} from {len(tasks)} scraper tasks")

    # Apply strict AI inference filter for all jobs
    from services.ai_filter import ai_filter_jobs
    visible = await ai_filter_jobs(
        jobs=all_jobs,
        query=query,
        location=location,
        work_modes=work_modes,
        experience=experience,
        job_types=job_types,
        salary_min=salary_min,
        date_posted=date_posted
    )

    # Apply sorting if requested
    if sort_by == "job-title-ascending":
        visible.sort(key=lambda j: j.title.lower())
    elif sort_by == "job-title-descending":
        visible.sort(key=lambda j: j.title.lower(), reverse=True)
    # else "latest" or by score (default if profile present)

    return SearchResponse(jobs=visible, total=len(visible), query=query, currency=currency)
