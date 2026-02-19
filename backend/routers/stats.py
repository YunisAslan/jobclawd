"""
Router: HTTP handler for dashboard stats.
Thin layer — delegates to application_repo.
"""
from fastapi import APIRouter

from models.schemas import StatsResponse
from repositories import application_repo

router = APIRouter()


@router.get("/stats", response_model=StatsResponse)
async def get_stats():
    return application_repo.get_stats()
