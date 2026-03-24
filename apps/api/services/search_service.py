"""
Service: orchestrates multi-source scraping, scoring, and result filtering.
Wraps the scraping pipeline with a PostgreSQL-backed cache (TTL = 1 hour).
"""
import asyncio
import json
import re
from typing import Optional

from models.schemas import JobListing, JobSource, SearchResponse, LocationFilter, UserProfile
from scraper.search import scrape_search
from scraper.linkedin import scrape_linkedin
from scraper.indeed import scrape_indeed
from db.database import get_db
from services.cache_service import make_cache_key
from repositories.cache_repo import get_cached_result, set_cached_result
from repositories.metadata_repo import upsert_metadata
from engine.scoring import score_job
from services.enrichment_service import enrich_jobs, merge_metadata_into_jobs, fetch_metadata_for_urls
from services.extraction.pipeline import process_jobs

# Currency symbols and codes that indicate a salary already has currency info
_HAS_CURRENCY = re.compile(
    r'[\$€£₼₺₽]|USD|EUR|GBP|AZN|TRY|RUB|TL|manat|руб',
    re.IGNORECASE,
)

_INFLIGHT_SEARCHES: dict[str, asyncio.Task] = {}
_SYNC_LINKEDIN_ENRICH_LIMIT = 12


def _append_currency(jobs: list, currency: str) -> None:
    """Append the resolved currency code to salary strings that don't already have one."""
    for job in jobs:
        sal = job.salary_str if hasattr(job, 'salary_str') else None
        if sal and not _HAS_CURRENCY.search(sal):
            job.salary_str = f"{sal} {currency}"


def _clone_jobs(jobs: list[JobListing]) -> list[JobListing]:
    return [JobListing(**json.loads(job.model_dump_json())) for job in jobs]


def _sort_jobs(jobs: list[JobListing], sort_by: Optional[str]) -> None:
    if sort_by == "job-title-ascending":
        jobs.sort(key=lambda j: j.title.lower())
    elif sort_by == "job-title-descending":
        jobs.sort(key=lambda j: j.title.lower(), reverse=True)


def _reset_scores(jobs: list[JobListing]) -> None:
    for job in jobs:
        job.match_score = 0
        job.match_level = "review"
        job.match_flags = []


def _finalize_response(
    base_response: SearchResponse,
    *,
    profile: Optional[UserProfile],
    sort_by: Optional[str],
    cached: bool,
) -> SearchResponse:
    jobs = _clone_jobs(base_response.jobs)
    _reset_scores(jobs)

    if profile:
        jobs = [score_job(job, profile) for job in jobs]

    _sort_jobs(jobs, sort_by)

    response = SearchResponse(
        jobs=jobs,
        total=len(jobs),
        query=base_response.query,
        currency=base_response.currency,
    )
    response.cached = cached
    return response


def _job_has_core_metadata(job: JobListing) -> bool:
    return all([
        job.salary_str,
        job.job_type_str,
        job.experience_str,
        job.work_mode_str,
    ])


async def _sync_enrich_top_linkedin_jobs(jobs: list[JobListing]) -> None:
    candidates = [
        job.url
        for job in jobs
        if job.source == JobSource.linkedin and not _job_has_core_metadata(job)
    ][:_SYNC_LINKEDIN_ENRICH_LIMIT]

    if not candidates:
        return

    print(f"[Search] Sync enriching top {len(candidates)} LinkedIn jobs before response")
    fetched = await fetch_metadata_for_urls(candidates)
    for url, meta in fetched.items():
        if not meta:
            continue
        try:
            upsert_metadata(url, **meta)
        except Exception as e:
            print(f"[Search] Sync enrichment DB error for {url}: {e}")


async def _build_preview_response(
    jobs: list[JobListing],
    *,
    query: str,
    location: Optional[LocationFilter],
    work_modes: Optional[list[str]],
    experience: Optional[list[str]],
    job_types: Optional[list[str]],
    salary_min: Optional[str],
    date_posted: Optional[str],
    currency: str,
    profile: Optional[UserProfile],
    sort_by: Optional[str],
) -> SearchResponse:
    preview_jobs = _clone_jobs(jobs)
    if not preview_jobs:
        return SearchResponse(jobs=[], total=0, query=query, currency=currency)

    try:
        job_dicts = [json.loads(job.model_dump_json()) for job in preview_jobs]
        job_dicts = merge_metadata_into_jobs(job_dicts)
        preview_jobs = [JobListing(**d) for d in job_dicts]
    except Exception as e:
        print(f"[Search] Preview metadata merge error (non-fatal): {e}")

    from services.ai_filter import ai_filter_jobs

    visible = await ai_filter_jobs(
        jobs=preview_jobs,
        query=query,
        location=location,
        work_modes=work_modes,
        experience=experience,
        job_types=job_types,
        salary_min=salary_min,
        date_posted=date_posted,
    )

    if currency and currency != "USD":
        _append_currency(visible, currency)

    base_response = SearchResponse(
        jobs=visible,
        total=len(visible),
        query=query,
        currency=currency,
    )
    return _finalize_response(
        base_response,
        profile=profile,
        sort_by=sort_by,
        cached=False,
    )


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
    progress_cb=None,
    event_cb=None,
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
        # Merge any metadata that was enriched in the background since last cache write
        if "jobs" in cached:
            cached["jobs"] = merge_metadata_into_jobs(cached["jobs"])
        base_response = SearchResponse(**cached)
        return _finalize_response(
            base_response,
            profile=profile,
            sort_by=sort_by,
            cached=True,
        )

    # ── In-flight dedupe for identical cold searches ────────────────────────
    if not force_refresh:
        inflight = _INFLIGHT_SEARCHES.get(cache_key)
        if inflight is not None:
            base_response = await asyncio.shield(inflight)
            return _finalize_response(
                base_response,
                profile=profile,
                sort_by=sort_by,
                cached=True,
            )

        task = asyncio.create_task(
            _run_uncached_search(
                cache_key=cache_key,
                filters_dict=filters_dict,
                query=query,
                sources=sources,
                location=location,
                work_modes=work_modes,
                experience=experience,
                job_types=job_types,
                date_posted=date_posted,
                salary_min=salary_min,
                sort_by=sort_by,
                progress_cb=progress_cb,
                profile=profile,
                event_cb=event_cb,
            )
        )
        _INFLIGHT_SEARCHES[cache_key] = task

        def _cleanup_inflight(done_task: asyncio.Task) -> None:
            if _INFLIGHT_SEARCHES.get(cache_key) is done_task:
                _INFLIGHT_SEARCHES.pop(cache_key, None)

        task.add_done_callback(_cleanup_inflight)
        base_response = await asyncio.shield(task)

        return _finalize_response(
            base_response,
            profile=profile,
            sort_by=sort_by,
            cached=False,
        )

    base_response = await _run_uncached_search(
        cache_key=cache_key,
        filters_dict=filters_dict,
        query=query,
        sources=sources,
        location=location,
        work_modes=work_modes,
        experience=experience,
        job_types=job_types,
        date_posted=date_posted,
        salary_min=salary_min,
        sort_by=sort_by,
        progress_cb=progress_cb,
        profile=profile,
        event_cb=event_cb,
    )

    return _finalize_response(
        base_response,
        profile=profile,
        sort_by=sort_by,
        cached=False,
    )


async def _run_uncached_search(
    *,
    cache_key: str,
    filters_dict: dict,
    query: str,
    sources: list[JobSource],
    location: Optional[LocationFilter],
    work_modes: Optional[list[str]],
    experience: Optional[list[str]],
    job_types: Optional[list[str]],
    date_posted: Optional[str],
    salary_min: Optional[str],
    sort_by: Optional[str],
    progress_cb=None,
    profile: Optional[UserProfile],
    event_cb=None,
) -> SearchResponse:
    """Run the shared search pipeline and return an unpersonalized base response."""
    import time
    t_total = time.perf_counter()
    timings: dict[str, float] = {}

    # ── Cache MISS — run full scraping pipeline ──────────────────────────────
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
    tasks: list[asyncio.Task] = []

    async def _run_scraper(source_name: str, coro):
        return source_name, await coro

    for shard in location_shards:
        if JobSource.jobsearch in sources:
            tasks.append(asyncio.create_task(_run_scraper(
                "jobsearch",
                scrape_search(
                    query, shard,
                    work_modes=work_modes,
                    experience=experience,
                    job_types=job_types,
                    date_posted=date_posted,
                    sort_by=sort_by,
                ),
            )))

        if JobSource.linkedin in sources:
            tasks.append(asyncio.create_task(_run_scraper(
                "linkedin",
                scrape_linkedin(
                    query,
                    shard,
                    work_modes=work_modes,
                    experience=experience,
                    job_types=job_types,
                    date_posted=date_posted,
                    sort_by=sort_by,
                ),
            )))
        if JobSource.indeed in sources:
            tasks.append(asyncio.create_task(_run_scraper(
                "indeed",
                scrape_indeed(
                    query,
                    shard,
                    work_modes=work_modes,
                    experience=experience,
                    job_types=job_types,
                    date_posted=date_posted,
                    sort_by=sort_by,
                ),
            )))

    if progress_cb:
        await progress_cb("scraping", "Searching job sources...", 0, 0)

    seen_urls: set[str] = set()
    all_jobs: list[JobListing] = []

    t0 = time.perf_counter()
    for task in asyncio.as_completed(tasks):
        try:
            source_name, result = await task
        except Exception as e:
            print(f"[Search] Scraper error: {e}")
            continue

        new_jobs = 0
        if isinstance(result, list):
            for job in result:
                if job.url not in seen_urls:
                    seen_urls.add(job.url)
                    all_jobs.append(job)
                    new_jobs += 1

        if progress_cb:
            await progress_cb(
                "found",
                f"Found {len(all_jobs)} positions",
                len(all_jobs),
                0,
            )

        if event_cb and new_jobs > 0:
            try:
                preview_response = await _build_preview_response(
                    all_jobs,
                    query=query,
                    location=location,
                    work_modes=work_modes,
                    experience=experience,
                    job_types=job_types,
                    salary_min=salary_min,
                    date_posted=date_posted,
                    currency=currency,
                    profile=profile,
                    sort_by=sort_by,
                )
                await event_cb({
                    "stage": "partial",
                    "message": f"{source_name} results ready",
                    "current": preview_response.total,
                    "total": preview_response.total,
                    "source": source_name,
                    "data": json.loads(preview_response.model_dump_json()),
                })
            except Exception as e:
                print(f"[Search] Partial emit error (non-fatal): {e}")

    timings["scraping"] = time.perf_counter() - t0

    print(f"[Search] Total unique jobs after merge: {len(all_jobs)} from {len(tasks)} scraper tasks")

    # ── Vacancy Intelligence Pipeline: extract, deduplicate, enrich ─────────
    try:
        t0 = time.perf_counter()
        all_job_dicts = [json.loads(j.model_dump_json()) for j in all_jobs]

        if progress_cb:
            await progress_cb("analyzing", "Extracting metadata...", 0, 0)

        # Run the extraction pipeline (deterministic + selective AI)
        all_job_dicts = await process_jobs(all_job_dicts, progress_cb=progress_cb)
        timings["pipeline"] = time.perf_counter() - t0

        t0 = time.perf_counter()
        # Also merge any background-enriched metadata from DB
        all_job_dicts = merge_metadata_into_jobs(all_job_dicts)
        all_jobs = [JobListing(**d) for d in all_job_dicts]
        timings["metadata_merge"] = time.perf_counter() - t0
    except Exception as e:
        print(f"[Search] Pipeline error (non-fatal, falling back): {e}")

    # Sync-enrich top LinkedIn jobs BEFORE filtering so the filter has rich metadata
    try:
        t0 = time.perf_counter()
        await _sync_enrich_top_linkedin_jobs(all_jobs)
        # Re-merge DB metadata so all_jobs gets the enriched values
        try:
            enriched_dicts = [json.loads(j.model_dump_json()) for j in all_jobs]
            enriched_dicts = merge_metadata_into_jobs(enriched_dicts)
            all_jobs = [JobListing(**d) for d in enriched_dicts]
        except Exception as e:
            print(f"[Search] Pre-filter merge error (non-fatal): {e}")
        timings["sync_visible_enrich"] = time.perf_counter() - t0
    except Exception as e:
        print(f"[Search] Sync enrichment error (non-fatal): {e}")

    if progress_cb:
        await progress_cb("filtering", "Filtering results", 0, 0)

    # Semantic AI filter
    t0 = time.perf_counter()
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
    timings["ai_filter"] = time.perf_counter() - t0

    # ── Final metadata merge for filtered results ────────────────
    t0 = time.perf_counter()
    try:
        job_dicts = [json.loads(j.model_dump_json()) for j in visible]
        job_dicts = merge_metadata_into_jobs(job_dicts)
        merged_jobs = [JobListing(**d) for d in job_dicts]
    except Exception as e:
        print(f"[Search] Metadata merge error (non-fatal): {e}")
        merged_jobs = visible
    timings["final_merge"] = time.perf_counter() - t0

    # Append currency to salary values that don't already include one
    if currency and currency != "USD":
        _append_currency(merged_jobs, currency)

    timings["total"] = time.perf_counter() - t_total

    # ── Print timing report ──────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"[Timing] Search pipeline for q=\"{query}\" ({len(merged_jobs)} results)")
    print(f"{'─'*60}")
    for stage, secs in timings.items():
        bar = "█" * int(min(secs / timings["total"], 1.0) * 30) if timings["total"] > 0 else ""
        print(f"  {stage:<20} {secs:>6.2f}s  {bar}")
    print(f"{'='*60}\n")

    base_response = SearchResponse(
        jobs=merged_jobs,
        total=len(merged_jobs),
        query=query,
        currency=currency,
    )

    # ── Write to cache (fire-and-forget — don't delay the response) ──────────
    asyncio.create_task(
        _store_cache(cache_key, filters_dict, base_response, len(merged_jobs))
    )

    # ── Background enrichment: fetch full descriptions for jobs missing metadata
    try:
        job_dicts_for_enrich = [json.loads(j.model_dump_json()) for j in merged_jobs]
        asyncio.create_task(enrich_jobs(job_dicts_for_enrich))
    except Exception as e:
        print(f"[Search] Enrichment launch error (non-fatal): {e}")

    return base_response


async def _store_cache(cache_key: str, filters_dict: dict, response: SearchResponse, job_count: int) -> None:
    """Runs in the background after the response is returned to the client."""
    try:
        result_dict = json.loads(response.model_dump_json())
        for job in result_dict.get("jobs", []):
            if isinstance(job, dict):
                # Keep DB cache minimal: do not persist scraped free-text snippets.
                job["description_snippet"] = None
                # Cache shared raw results, not user-personalized scores.
                job["match_score"] = 0
                job["match_level"] = "review"
                job["match_flags"] = []
        set_cached_result(
            filters_hash=cache_key,
            filters_dict=filters_dict,
            result=result_dict,
            job_count=job_count,
        )
        print(f"[Cache] Stored {job_count} jobs for key {cache_key[:12]}...")
    except Exception as e:
        print(f"[Cache] Store error: {e}")
