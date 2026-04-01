"""
Router: HTTP handlers for job search and job detail.
Thin layer — delegates all business logic to services.
"""
import asyncio
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from models.schemas import (
    SearchRequest,
    SearchResponse,
    JobDetailRequest,
    JobDetailResponse,
    JobSource,
    UserProfile,
)
from services.job_detail_service import get_enhanced_job_detail
from services.search_service import run_search
from repositories import profile_repo
from repositories.credits_repo import get_credits, use_credit
from utils.auth_utils import get_optional_email, get_current_email

router = APIRouter()

_ALLOWED_HOSTS = ["jobsearch.az", "linkedin.com", "indeed.com", "az.indeed.com"]


@router.post("/search", response_model=SearchResponse)
async def search_jobs(request: SearchRequest, email: Optional[str] = Depends(get_optional_email)):
    sources = request.sources if request.sources else [JobSource.jobsearch, JobSource.linkedin, JobSource.indeed]

    # Check credits before searching (only matters for cache misses, checked after)
    if email:
        credits = get_credits(email)
        if credits["credits"] <= 0:
            raise HTTPException(
                status_code=429,
                detail="No search credits remaining.",
            )

    profile: UserProfile | None = None
    raw = profile_repo.get_profile(email) if email else None
    if raw:
        try:
            profile = UserProfile(**raw)
        except Exception:
            profile = None

    try:
        result = await run_search(
            query=request.query,
            sources=sources,
            location=request.location,
            work_modes=request.workModes,
            experience=request.experience,
            job_types=request.jobTypes,
            date_posted=request.datePosted,
            salary_min=request.salaryMin,
            sort_by=request.sortBy,
            profile=profile,
            force_refresh=request.forceRefresh,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Search error: {e}")

    # Deduct credit only on cache miss (actual scraping)
    if email and not result.cached:
        use_credit(email)

    return result


@router.post("/search/stream")
async def search_jobs_stream(request: SearchRequest, email: Optional[str] = Depends(get_optional_email)):
    """SSE endpoint that streams progress events during search."""
    sources = request.sources if request.sources else [JobSource.jobsearch, JobSource.linkedin, JobSource.indeed]

    if email:
        credits = get_credits(email)
        if credits["credits"] <= 0:
            raise HTTPException(status_code=429, detail="No search credits remaining.")

    profile: UserProfile | None = None
    raw = profile_repo.get_profile(email) if email else None
    if raw:
        try:
            profile = UserProfile(**raw)
        except Exception:
            profile = None

    # Queue for progress events
    progress_queue: asyncio.Queue = asyncio.Queue()

    async def progress_cb(stage: str, message: str, current: int, total: int):
        await progress_queue.put({
            "stage": stage,
            "message": message,
            "current": current,
            "total": total,
        })

    async def event_cb(event: dict):
        await progress_queue.put(event)

    async def run_and_signal():
        try:
            result = await run_search(
                query=request.query,
                sources=sources,
                location=request.location,
                work_modes=request.workModes,
                experience=request.experience,
                job_types=request.jobTypes,
                date_posted=request.datePosted,
                salary_min=request.salaryMin,
                sort_by=request.sortBy,
                profile=profile,
                force_refresh=request.forceRefresh,
                progress_cb=progress_cb,
                event_cb=event_cb,
            )
            # Deduct credit on cache miss
            if email and not result.cached:
                use_credit(email)
            await progress_queue.put({"stage": "done", "data": json.loads(result.model_dump_json())})
        except Exception as e:
            await progress_queue.put({"stage": "error", "message": str(e)})

    async def event_stream():
        task = asyncio.create_task(run_and_signal())
        try:
            while True:
                event = await progress_queue.get()
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                if event.get("stage") in ("done", "error"):
                    break
        finally:
            if not task.done():
                task.cancel()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/credits")
async def get_user_credits(email: str = Depends(get_current_email)):
    return get_credits(email)


@router.post("/job-details", response_model=JobDetailResponse)
async def get_job_details(request: JobDetailRequest):
    if not any(host in request.url for host in _ALLOWED_HOSTS):
        raise HTTPException(
            status_code=400,
            detail="Only jobsearch.az, LinkedIn, and Indeed URLs are accepted.",
        )
    try:
        return await get_enhanced_job_detail(request.url)
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
