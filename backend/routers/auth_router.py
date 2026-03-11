from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from services.auth_service import (
    create_and_store_token,
    send_magic_link_email,
    verify_token,
    get_google_auth_url,
    handle_google_callback,
    FRONTEND_URL,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class MagicLinkRequest(BaseModel):
    email: str


class VerifyTokenRequest(BaseModel):
    token: str


@router.post("/send-magic-link")
async def send_magic_link(body: MagicLinkRequest):
    try:
        token = create_and_store_token(body.email)
        await send_magic_link_email(body.email, token)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to send email: {exc}")
    return {"success": True}


@router.post("/verify-magic-link")
async def verify_magic_link(body: VerifyTokenRequest):
    try:
        return verify_token(body.token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/google")
async def google_oauth_start():
    try:
        url = get_google_auth_url()
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return RedirectResponse(url)


@router.get("/callback/google")
async def google_oauth_callback(
    code: Optional[str] = None,
    error: Optional[str] = None,
):
    if error or not code:
        return RedirectResponse(f"{FRONTEND_URL}/auth/login?error=google_cancelled")
    try:
        redirect_url = await handle_google_callback(code)
        return RedirectResponse(redirect_url)
    except RuntimeError as e:
        return RedirectResponse(f"{FRONTEND_URL}/auth/login?error={e}")
    except Exception:
        return RedirectResponse(f"{FRONTEND_URL}/auth/login?error=google_failed")
