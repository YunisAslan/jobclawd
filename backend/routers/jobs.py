"""
Router: HTTP handlers for job search and job detail.
Thin layer — delegates all business logic to services.
"""
from fastapi import APIRouter, HTTPException

from models.schemas import (
    SearchRequest,
    SearchResponse,
    JobDetailRequest,
    JobDetailResponse,
    JobSource,
)
from scraper.detail import scrape_job_detail
from services.search_service import run_search

router = APIRouter()

_ALLOWED_HOSTS = ["jobsearch.az", "linkedin.com", "indeed.com", "az.indeed.com"]


@router.post("/search", response_model=SearchResponse)
async def search_jobs(request: SearchRequest):
    sources = request.sources if request.sources else [JobSource.jobsearch, JobSource.linkedin, JobSource.indeed]
    try:
        return await run_search(
            query=request.query,
            sources=sources,
            location=request.location,
            work_modes=request.workModes,
            experience=request.experience,
            job_types=request.jobTypes,
            date_posted=request.datePosted,
            salary_min=request.salaryMin,
            sort_by=request.sortBy,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Search error: {e}")


@router.post("/job-details", response_model=JobDetailResponse)
async def get_job_details(request: JobDetailRequest):
    if not any(host in request.url for host in _ALLOWED_HOSTS):
        raise HTTPException(
            status_code=400,
            detail="Only jobsearch.az, LinkedIn, and Indeed URLs are accepted.",
        )
    try:
        return await scrape_job_detail(request.url)
    except TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="Job page timed out. Please try again.",
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch job details: {str(e)}",
        )
