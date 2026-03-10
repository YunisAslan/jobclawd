"""
Router: HTTP handlers for SMTP and autopilot settings.
Thin layer — delegates to settings_repo.
SMTP settings are per-user (keyed by the authenticated user's email).
"""
from fastapi import APIRouter, Depends, HTTPException

from models.schemas import SMTPSettings, AutopilotSettings
from repositories import settings_repo
from utils.auth_utils import get_current_email

router = APIRouter()


@router.get("/settings/smtp", response_model=SMTPSettings)
async def get_smtp_settings(email: str = Depends(get_current_email)):
    config = settings_repo.get_smtp_config(user_email=email)
    if not config:
        raise HTTPException(status_code=404, detail="SMTP configuration not found.")
    # Omit password from GET response
    return SMTPSettings(**{**config.model_dump(), "password": None})


@router.delete("/settings/smtp")
async def delete_smtp_settings(email: str = Depends(get_current_email)):
    settings_repo.delete_smtp_config(user_email=email)
    return {"success": True, "message": "SMTP configuration removed."}


@router.post("/settings/smtp")
async def save_smtp_settings(
    settings: SMTPSettings,
    email: str = Depends(get_current_email),
):
    settings_repo.save_smtp_config(settings, user_email=email)
    return {"success": True, "message": "SMTP configuration saved."}


@router.get("/settings/gmail-status")
async def gmail_status(email: str = Depends(get_current_email)):
    """Returns whether the user has a stored Google refresh token (can send via Gmail API)."""
    token = settings_repo.get_google_refresh_token(email)
    return {"connected": token is not None}


@router.get("/settings/autopilot", response_model=AutopilotSettings)
async def get_autopilot():
    return AutopilotSettings(enabled=settings_repo.get_autopilot_enabled())


@router.post("/settings/autopilot")
async def save_autopilot(settings: AutopilotSettings):
    settings_repo.save_autopilot_enabled(settings.enabled)
    return {"success": True, "enabled": settings.enabled}
