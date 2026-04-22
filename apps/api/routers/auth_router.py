from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from repositories.profile_repo import delete_account
from services.auth_service import (
    create_and_store_token,
    send_magic_link_email,
    verify_token,
    create_reauth_code,
    send_reauth_code_email,
    create_email_change_request,
    send_email_change_verification,
    send_email_change_notification,
    verify_email_change,
    revert_email_change,
    get_google_auth_url,
    handle_google_callback,
    FRONTEND_URL,
)
from utils.auth_utils import get_current_email

router = APIRouter(prefix="/auth", tags=["auth"])


class MagicLinkRequest(BaseModel):
    email: str


class VerifyTokenRequest(BaseModel):
    token: str


class EmailChangeRequest(BaseModel):
    new_email: str
    otp: str


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


@router.post("/send-reauth-code", status_code=204)
async def send_reauth_code(email: str = Depends(get_current_email)):
    try:
        code = create_reauth_code(email)
        await send_reauth_code_email(email, code)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to send code: {exc}")


@router.post("/request-email-change", status_code=204)
async def request_email_change(
    body: EmailChangeRequest,
    email: str = Depends(get_current_email),
):
    try:
        token = create_email_change_request(email, body.new_email, body.otp)
        await send_email_change_verification(body.new_email, email, token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to send email: {exc}")


@router.post("/verify-email-change")
async def verify_email_change_route(body: VerifyTokenRequest):
    try:
        result = verify_email_change(body.token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    import asyncio
    asyncio.create_task(
        send_email_change_notification(result["old_email"], result["user"]["email"], result["revert_token"])
    )

    return result


@router.post("/revert-email-change")
async def revert_email_change_route(body: VerifyTokenRequest):
    try:
        return revert_email_change(body.token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/google")
async def google_oauth_start():
    try:
        url = get_google_auth_url()
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return RedirectResponse(url)


@router.delete("/account")
async def delete_user_account(email: str = Depends(get_current_email)):
    try:
        delete_account(email)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to delete account: {exc}")
    return {"success": True}


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
