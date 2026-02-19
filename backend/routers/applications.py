"""
Router: HTTP handlers for apply, list, and status update.
Thin layer — delegates to apply_service and application_repo.
"""
from fastapi import APIRouter, HTTPException

from models.schemas import (
    ApplyRequest,
    ApplyResponse,
    ApplicationRecord,
    ApplicationStatusUpdate,
)
from repositories import application_repo
from services.apply_service import process_apply

router = APIRouter()


@router.post("/apply", response_model=ApplyResponse)
async def apply_to_job(request: ApplyRequest):
    try:
        return await process_apply(request)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/applications", response_model=list[ApplicationRecord])
async def get_applications():
    return application_repo.get_all_applications()


@router.patch("/applications/{app_id}", response_model=ApplicationRecord)
async def update_application(app_id: int, update: ApplicationStatusUpdate):
    record = application_repo.update_application(app_id, update.status, update.notes)
    if not record:
        raise HTTPException(status_code=404, detail="Müraciət tapılmadı.")
    return record
