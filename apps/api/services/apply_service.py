"""
Service: handles the full apply flow.
  1. Persist application to DB via repository.
  2. Send email when hr_email is present:
     Priority order:
       a) User's own SMTP config (sends from user's email)
       b) JobClawd system SMTP fallback (sends from JobClawd mail)
"""
import os
from pathlib import Path
from typing import Optional
from models.schemas import ApplyRequest, ApplyResponse, SMTPSettings
from repositories import application_repo, settings_repo
from services.smtp_sender import send_application_email

# Must match UPLOADS_DIR in profile_router.py
_UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads" / "cv"


def _resolve_cv_path(cv_url: Optional[str]) -> Optional[Path]:
    """Extract filename from URL like /api/files/cv/{name} and return disk path."""
    if not cv_url:
        return None
    filename = cv_url.rstrip("/").split("/")[-1]
    path = _UPLOADS_DIR / filename
    return path if path.exists() else None


def _get_system_gmail_smtp() -> Optional[SMTPSettings]:
    """Build SMTPSettings from system Gmail env vars, or None if not configured."""
    try:
        return SMTPSettings(
            host="smtp.gmail.com",
            port=587,
            username=os.environ["GMAIL_USER"],
            password=os.environ["GMAIL_APP_PASSWORD"],
            from_name="JobClawd",
        )
    except KeyError:
        return None


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

    # 2. Send email when hr_email is available
    sent_via_smtp = False
    send_error: Optional[str] = None

    if request.hr_email and request.profile:
        user_email = request.profile.email
        name_full = f"{request.profile.name} {request.profile.surname}".strip()
        subject = request.email_subject or f"Job application: {request.job_title} — {name_full}"
        body = request.cover_letter or ""
        cv_path = _resolve_cv_path(request.cv_url)
        extra_cv_paths = [
            p for url in (request.extra_cv_urls or [])
            if (p := _resolve_cv_path(url)) is not None
        ]

        # a) User's own SMTP config (sends from user's email)
        smtp = settings_repo.get_smtp_config(user_email=user_email)
        if not smtp:
            # b) JobClawd system SMTP fallback
            smtp = _get_system_gmail_smtp()

        if smtp:
            try:
                await send_application_email(
                    smtp=smtp,
                    profile=request.profile,
                    to_email=request.hr_email,
                    job_title=request.job_title,
                    company=request.company,
                    cv_url=request.cv_url,
                    cv_path=cv_path,
                    extra_cv_paths=extra_cv_paths,
                    custom_subject=request.email_subject,
                    custom_body=request.cover_letter,
                )
                sent_via_smtp = True
            except Exception as e:
                send_error = str(e)

    # Determine status and failure reason
    status = "sent"
    failure_reason = None

    if request.hr_email and not sent_via_smtp:
        if send_error and "authentication" in send_error.lower():
            failure_reason = "smtp_auth_failed"
            status = "failed"
            msg = "Application saved, but email failed: SMTP authentication error."
        elif send_error and "connection" in send_error.lower():
            failure_reason = "smtp_connection_failed"
            status = "failed"
            msg = "Application saved, but email failed: Could not connect to mail server."
        elif send_error:
            failure_reason = "email_send_failed"
            status = "failed"
            msg = f"Application saved, but email failed: {send_error}"
        else:
            failure_reason = "no_smtp_configured"
            status = "open_manually"
            msg = "Application saved. No email method available — apply manually."
    elif sent_via_smtp:
        msg = "Application saved. Email sent successfully."
    elif not request.hr_email:
        # Non-email apply methods
        apply_method = request.source.value if request.source else "direct"
        if apply_method in ("linkedin", "indeed"):
            status = "open_manually"
            msg = "Application tracked. Open the job page to complete your application."
        else:
            status = "open_manually"
            msg = "Application tracked. Complete your application on the external site."
    else:
        msg = "Application saved."

    return ApplyResponse(
        success=True,
        application_id=app_id,
        message=msg,
        sent_via_smtp=sent_via_smtp,
        failure_reason=failure_reason,
        status=status,
    )
