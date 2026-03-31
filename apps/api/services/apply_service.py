"""
Service: handles the simplified apply flow.
  1. Persist application to DB via repository.
  2. Return a tracking/open-manually response.
"""
from models.schemas import ApplyRequest, ApplyResponse
from repositories import application_repo


async def process_apply(request: ApplyRequest) -> ApplyResponse:
    """Save application to DB, then send email directly when hr_email is present."""
    # 1. Persist — raises RuntimeError on DB failure
    try:
        app_id = application_repo.insert_application(
            job_url=request.job_url,
            job_title=request.job_title,
            company=request.company,
            source=request.source.value if request.source else "jobsearch",
            hr_email=request.hr_email,
            cv_name=request.cv_name,
            cv_url=request.cv_url,
            match_score=request.match_score,
            match_level=request.match_level.value if request.match_level else None,
        )
    except Exception as e:
        raise RuntimeError(f"Database error: {e}") from e

    status = "open_manually"
    msg = "Application tracked. Complete your application on the external site."

    return ApplyResponse(
        success=True,
        application_id=app_id,
        message=msg,
        status=status,
    )
