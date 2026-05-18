"""
Router: HTTP handler for dashboard stats and analytics.
Thin layer — delegates to repositories.
"""
from fastapi import APIRouter, Depends

from models.schemas import StatsResponse, AnalyticsResponse, PlatformStatsResponse, JobSitemapResponse
from repositories import application_repo, analytics_repo
from utils.auth_utils import get_current_email

router = APIRouter()


@router.get("/stats", response_model=StatsResponse)
async def get_stats():
    return application_repo.get_stats()


@router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(email: str = Depends(get_current_email)):
    return analytics_repo.get_analytics(email)


@router.get("/public/platform-stats", response_model=PlatformStatsResponse)
async def get_platform_stats():
    """Public endpoint — no auth required. Returns aggregate counts across all users."""
    return analytics_repo.get_platform_stats()


@router.get("/public/job-sitemap", response_model=JobSitemapResponse)
async def get_job_sitemap():
    """Public endpoint — no auth required. Returns recent job listings for SEO sitemap generation."""
    return analytics_repo.get_job_sitemap()
