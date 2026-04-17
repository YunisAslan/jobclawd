"""
Router: HTTP handler for dashboard stats and analytics.
Thin layer — delegates to application_repo.
"""
from fastapi import APIRouter

from models.schemas import StatsResponse, AnalyticsResponse
from repositories import application_repo

router = APIRouter()


@router.get("/stats", response_model=StatsResponse)
async def get_stats():
    return application_repo.get_stats()


@router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics():
    return application_repo.get_analytics()
