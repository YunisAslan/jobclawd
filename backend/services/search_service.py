"""
Service: orchestrates multi-source scraping, scoring, and result filtering.
Contains the business logic that was previously mixed into the router.
"""
import asyncio
from typing import Optional

from models.schemas import JobListing, JobSource, MatchLevel, SearchResponse, UserProfile
from scraper.search import scrape_search
from scraper.linkedin import scrape_linkedin
from scraper.indeed import scrape_indeed
from engine.scoring import score_job


async def run_search(
    query: str,
    sources: list[JobSource],
    profile: Optional[UserProfile],
) -> SearchResponse:
    """Fan out scrapers in parallel, score results, filter trash, sort by score desc."""
    tasks = []
    if JobSource.jobsearch in sources:
        tasks.append(scrape_search(query))
    if JobSource.linkedin in sources:
        tasks.append(scrape_linkedin(query))
    if JobSource.indeed in sources:
        tasks.append(scrape_indeed(query))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    all_jobs: list[JobListing] = []
    for result in results:
        if isinstance(result, Exception):
            continue  # non-fatal: skip failed sources
        if isinstance(result, list):
            all_jobs.extend(result)

    if profile:
        scored: list[JobListing] = []
        for job in all_jobs:
            try:
                scored.append(score_job(job, profile))
            except Exception:
                scored.append(job)
        all_jobs = scored

        visible = [j for j in all_jobs if j.match_level != MatchLevel.trash]
        visible.sort(key=lambda j: j.match_score, reverse=True)
    else:
        visible = all_jobs

    return SearchResponse(jobs=visible, total=len(visible), query=query)
