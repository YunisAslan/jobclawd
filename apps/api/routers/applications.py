"""
Router: HTTP handler for job application submission.
"""
from fastapi import APIRouter, HTTPException

from models.schemas import ApplyRequest, ApplyResponse
from services.apply_service import process_apply

router = APIRouter()


@router.post("/apply", response_model=ApplyResponse)
async def apply_to_job(request: ApplyRequest):
    try:
        return await process_apply(request)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
