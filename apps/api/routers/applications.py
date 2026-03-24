"""
Router: HTTP handlers for job application submission and readiness.
"""
from fastapi import APIRouter, HTTPException

from models.schemas import (
    ApplyRequest,
    ApplyResponse,
    ApplyReadinessRequest,
    ApplyReadinessResponse,
)
from services.apply_service import process_apply
from services.apply_readiness import compute_apply_readiness

router = APIRouter()


@router.post("/apply", response_model=ApplyResponse)
async def apply_to_job(request: ApplyRequest):
    try:
        return await process_apply(request)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/apply/readiness", response_model=ApplyReadinessResponse)
async def check_readiness(request: ApplyReadinessRequest):
    """Calculate apply readiness for a job + profile combination."""
    result = compute_apply_readiness(
        profile=request.profile,
        job=request.job,
    )
    return ApplyReadinessResponse(**result)
