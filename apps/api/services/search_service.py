"""
Service: orchestrates multi-source scraping, scoring, and result filtering.
Wraps the scraping pipeline with a PostgreSQL-backed cache (TTL = 1 hour).
"""
import asyncio
import json
from typing import Optional

from models.schemas import JobListing, JobSource, SearchResponse, LocationFilter, UserProfile
from scraper.search import scrape_search
from scraper.linkedin import scrape_linkedin
from scraper.indeed import scrape_indeed
from db.database import get_db
from services.cache_service import make_cache_key
from repositories.cache_repo import get_cached_result, set_cached_result
from engine.scoring import score_job


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
    profile: Optional[UserProfile] = None,
    force_refresh: bool = False,
) -> SearchResponse:
    """
    1. Build a deterministic cache key from all filters.
    2. Return instantly if a fresh cache entry exists.
    3. Otherwise run the full scraping pipeline, then store the result.
    """

    # ── Build filter dict matching the SearchRequest shape ──────────────────
    filters_dict = {
        "query": query,
        "sources": [s.value if hasattr(s, "value") else s for s in sources],
        "location": location.model_dump() if location else None,
        "workModes": work_modes,
        "experience": experience,
        "jobTypes": job_types,
        "datePosted": date_posted,
        "salaryMin": salary_min,
        "sortBy": sort_by,
    }

    cache_key = make_cache_key(filters_dict)

    # ── Cache HIT ────────────────────────────────────────────────────────────
    cached = get_cached_result(cache_key) if not force_refresh else None
    if cached is not None:
        resp = SearchResponse(**cached)
        resp.cached = True
        return resp

    # ── Cache MISS — run full scraping pipeline ──────────────────────────────
    # Expand multi-value location into per-country shards so each scraper
    # receives a proper single-location URL, then merge all results.
    location_shards: list[Optional[LocationFilter]] = []
    if location and location.values and len(location.values) > 1:
        for val in location.values:
            location_shards.append(LocationFilter(type=location.type, value=val, values=[val]))
    else:
        location_shards.append(location)

    # Resolve display currency from first shard
    currency = "USD"
    first_loc = location_shards[0] if location_shards else None
    if first_loc and first_loc.type in ["country", "city"]:
        country_code: Optional[str] = None
        if first_loc.type == "country":
            country_code = first_loc.value or (first_loc.values[0] if first_loc.values else None)
        elif first_loc.type == "city" and first_loc.values:
            with get_db() as conn:
                row = conn.execute(
                    "SELECT country_code FROM cities WHERE value = %s", (first_loc.values[0],)
                ).fetchone()
                if row:
                    country_code = row["country_code"]
        if country_code:
            with get_db() as conn:
                row = conn.execute(
                    "SELECT currency FROM countries WHERE code = %s", (country_code,)
                ).fetchone()
                if row:
                    currency = row["currency"]

    # Build scraper tasks — one set per location shard
    tasks = []
    for shard in location_shards:
        shard_country = None
        if shard and shard.type == "country":
            shard_country = shard.value or (shard.values[0] if shard.values else None)
        elif shard and shard.type == "city" and shard.values:
            with get_db() as conn:
                row = conn.execute(
                    "SELECT country_code FROM cities WHERE value = %s", (shard.values[0],)
                ).fetchone()
                if row:
                    shard_country = row["country_code"]

        if JobSource.jobsearch in sources:
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

    # Merge and deduplicate by URL
    seen_urls: set[str] = set()
    all_jobs: list[JobListing] = []
    for result in results:
        if isinstance(result, Exception):
            print(f"[Search] Scraper error: {result}")
            continue
        if isinstance(result, list):
            for job in result:
                if job.url not in seen_urls:
                    seen_urls.add(job.url)
                    all_jobs.append(job)

    print(f"[Search] Total unique jobs after merge: {len(all_jobs)} from {len(tasks)} scraper tasks")

    # Semantic AI filter
    from services.ai_filter import ai_filter_jobs
    visible = await ai_filter_jobs(
        jobs=all_jobs,
        query=query,
        location=location,
        work_modes=work_modes,
        experience=experience,
        job_types=job_types,
        salary_min=salary_min,
        date_posted=date_posted,
    )

    # Score jobs against user profile
    if profile:
        visible = [score_job(job, profile) for job in visible]

    # Sort
    if sort_by == "job-title-ascending":
        visible.sort(key=lambda j: j.title.lower())
    elif sort_by == "job-title-descending":
        visible.sort(key=lambda j: j.title.lower(), reverse=True)

    response = SearchResponse(jobs=visible, total=len(visible), query=query, currency=currency)

    # ── Write to cache (fire-and-forget — don't delay the response) ──────────
    asyncio.create_task(
        _store_cache(cache_key, filters_dict, response, len(visible))
    )

    return response


async def _store_cache(cache_key: str, filters_dict: dict, response: SearchResponse, job_count: int) -> None:
    """Runs in the background after the response is returned to the client."""
    try:
        result_dict = json.loads(response.model_dump_json())
        set_cached_result(
            filters_hash=cache_key,
            filters_dict=filters_dict,
            result=result_dict,
            job_count=job_count,
        )
        print(f"[Cache] Stored {job_count} jobs for key {cache_key[:12]}...")
    except Exception as e:
        print(f"[Cache] Store error: {e}")
