"""
Router: HTTP handlers for SMTP and autopilot settings.
Thin layer — delegates to settings_repo.
"""
from fastapi import APIRouter, HTTPException

from models.schemas import SMTPSettings, AutopilotSettings
from repositories import settings_repo

router = APIRouter()


@router.get("/settings/smtp", response_model=SMTPSettings)
async def get_smtp_settings():
    config = settings_repo.get_smtp_config()
    if not config:
        raise HTTPException(status_code=404, detail="SMTP konfiqurasiyası tapılmadı.")
    # Omit password from GET response
    return SMTPSettings(**{**config.model_dump(), "password": None})


@router.post("/settings/smtp")
async def save_smtp_settings(settings: SMTPSettings):
    settings_repo.save_smtp_config(settings)
    return {"success": True, "message": "SMTP konfiqurasiyası saxlanıldı."}


@router.get("/settings/autopilot", response_model=AutopilotSettings)
async def get_autopilot():
    return AutopilotSettings(enabled=settings_repo.get_autopilot_enabled())


@router.post("/settings/autopilot")
async def save_autopilot(settings: AutopilotSettings):
    settings_repo.save_autopilot_enabled(settings.enabled)
    return {"success": True, "enabled": settings.enabled}
