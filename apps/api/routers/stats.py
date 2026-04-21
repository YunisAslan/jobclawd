"""
Router: HTTP handler for dashboard stats and analytics.
Thin layer — delegates to repositories.
"""
from fastapi import APIRouter, Depends

from models.schemas import StatsResponse, AnalyticsResponse
from repositories import application_repo, analytics_repo
from utils.auth_utils import get_current_email

router = APIRouter()


@router.get("/stats", response_model=StatsResponse)
async def get_stats():
    return application_repo.get_stats()


@router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(email: str = Depends(get_current_email)):
    return analytics_repo.get_analytics(email)
