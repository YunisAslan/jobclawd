"""
Service: handles the full apply flow.
  1. Persist application to DB via repository.
  2. If autopilot is enabled and SMTP is configured, send email.
Contains business logic that was previously mixed into the router.
"""
from models.schemas import ApplyRequest, ApplyResponse
from repositories import application_repo, settings_repo
from services.smtp_sender import send_application_email


async def process_apply(request: ApplyRequest) -> ApplyResponse:
    """Save application to DB, then optionally send via SMTP on autopilot."""
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

    # 2. Autopilot SMTP send (non-fatal — failure never blocks the saved record)
    sent_via_smtp = False
    if request.hr_email and request.profile:
        try:
            autopilot_on = settings_repo.get_autopilot_enabled()
            smtp = settings_repo.get_smtp_config()
            if autopilot_on and smtp:
                await send_application_email(
                    smtp=smtp,
                    profile=request.profile,
                    to_email=request.hr_email,
                    job_title=request.job_title,
                    company=request.company,
                    cv_url=request.cv_url,
                )
                sent_via_smtp = True
        except Exception:
            pass

    return ApplyResponse(
        success=True,
        application_id=app_id,
        message="Application saved." + (" Email sent." if sent_via_smtp else ""),
        sent_via_smtp=sent_via_smtp,
    )
