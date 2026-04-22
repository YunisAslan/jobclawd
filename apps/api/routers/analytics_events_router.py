"""
Router: thin HTTP handlers for analytics event tracking.
Each endpoint logs one user action; responses are intentionally minimal.
"""
from fastapi import APIRouter, Depends

from models.schemas import (
    CvAnalyzedEventRequest,
    SuggestionAppliedEventRequest,
    ImpactCheckedEventRequest,
    ApplyClickEventRequest,
)
from repositories import analytics_events_repo
from utils.auth_utils import get_current_email

router = APIRouter(tags=["analytics-events"])


@router.post("/analytics/cv-analyzed", status_code=204)
async def track_cv_analyzed(
    request: CvAnalyzedEventRequest,
    email: str = Depends(get_current_email),
):
    analytics_events_repo.insert_cv_analysis_event(
        user_email=email,
        cv_url=request.cv_url,
        cv_name=request.cv_name,
        job_url=request.job_url,
        job_title=request.job_title,
        company=request.company,
        overall_score=request.overall_score,
        match_level=request.match_level,
    )


@router.post("/analytics/suggestion-applied", status_code=204)
async def track_suggestion_applied(
    request: SuggestionAppliedEventRequest,
    email: str = Depends(get_current_email),
):
    analytics_events_repo.insert_suggestion_event(
        user_email=email,
        cv_name=request.cv_name,
        job_url=request.job_url,
        category=request.category,
        priority=request.priority,
    )


@router.post("/analytics/impact-checked", status_code=204)
async def track_impact_checked(
    request: ImpactCheckedEventRequest,
    email: str = Depends(get_current_email),
):
    analytics_events_repo.insert_impact_check_event(
        user_email=email,
        cv_name=request.cv_name,
        job_url=request.job_url,
        score_before=request.score_before,
        score_after=request.score_after,
    )


@router.post("/analytics/apply-clicked", status_code=204)
async def track_apply_clicked(
    request: ApplyClickEventRequest,
    email: str = Depends(get_current_email),
):
    analytics_events_repo.insert_apply_click_event(
        user_email=email,
        job_url=request.job_url,
        job_title=request.job_title,
        company=request.company,
    )
