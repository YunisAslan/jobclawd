"""
Router: Magic link + Google OAuth authentication.
POST /auth/send-magic-link      — generates token, sends email via Gmail
POST /auth/verify-magic-link    — verifies token, returns signed JWT
GET  /auth/google               — redirect to Google OAuth consent screen
GET  /auth/google/callback      — exchange code, issue JWT, redirect to frontend
"""
import os
import secrets
import urllib.parse
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import aiosmtplib
import httpx
import jwt
from dotenv import load_dotenv
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from db.database import get_db
from repositories.settings_repo import save_google_refresh_token

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

router = APIRouter(prefix="/auth", tags=["auth"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
TOKEN_TTL_MINUTES = 15
JWT_TTL_DAYS = 30

GMAIL_USER = os.getenv("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "").replace(" ", "")
JWT_SECRET = os.getenv("JWT_SECRET", "changeme-local-dev-only")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/callback/google")


class MagicLinkRequest(BaseModel):
    email: str


class VerifyTokenRequest(BaseModel):
    token: str


@router.post("/send-magic-link")
async def send_magic_link(body: MagicLinkRequest):
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        raise HTTPException(
            status_code=500,
            detail="Server email is not configured. Contact the administrator.",
        )

    token = secrets.token_urlsafe(32)
    expires_at = (datetime.utcnow() + timedelta(minutes=TOKEN_TTL_MINUTES)).isoformat()

    with get_db() as db:
        db.execute("DELETE FROM auth_tokens WHERE email = ?", (body.email,))
        db.execute(
            "INSERT INTO auth_tokens (email, token, expires_at) VALUES (?, ?, ?)",
            (body.email, token, expires_at),
        )

    magic_url = f"{FRONTEND_URL}/auth/verify?token={token}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "JobClawd — Sign-in link"
    msg["From"] = f"JobClawd <{GMAIL_USER}>"
    msg["To"] = body.email

    html_body = f"""
    <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;
                padding:40px 32px;background:#0a0a0a;color:#fff;border-radius:16px;
                border:1px solid rgba(255,255,255,0.08)">
      <p style="font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
                color:#10B981;margin:0 0 20px">JobClawd</p>
      <h2 style="color:#fff;font-size:22px;margin:0 0 12px">Your sign-in link</h2>
      <p style="color:#888;font-size:14px;margin:0 0 28px;line-height:1.6">
        This link expires in <strong style="color:#fff">{TOKEN_TTL_MINUTES} minutes</strong>
        and can only be used once.
      </p>
      <a href="{magic_url}"
         style="display:inline-block;background:#10B981;color:#fff;padding:14px 28px;
                border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
        Sign in →
      </a>
      <p style="color:#444;font-size:12px;margin:28px 0 0;line-height:1.6">
        If you did not request this, you can safely ignore this email.
      </p>
    </div>
    """

    msg.attach(MIMEText(html_body, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname="smtp.gmail.com",
            port=587,
            start_tls=True,
            username=GMAIL_USER,
            password=GMAIL_APP_PASSWORD,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to send email: {exc}",
        )

    return {"success": True}


@router.post("/verify-magic-link")
async def verify_magic_link(body: VerifyTokenRequest):
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM auth_tokens WHERE token = ? AND used = 0",
            (body.token,),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=400, detail="Invalid or already used link.")

    expires_at = datetime.fromisoformat(row["expires_at"])
    if datetime.utcnow() > expires_at:
        with get_db() as db:
            db.execute("DELETE FROM auth_tokens WHERE token = ?", (body.token,))
        raise HTTPException(status_code=400, detail="Link has expired. Please request a new one.")

    with get_db() as db:
        db.execute("UPDATE auth_tokens SET used = 1 WHERE token = ?", (body.token,))

    email: str = row["email"]
    name = email.split("@")[0]

    access_token = jwt.encode(
        {
            "sub": email,
            "name": name,
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(days=JWT_TTL_DAYS),
        },
        JWT_SECRET,
        algorithm="HS256",
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"email": email, "name": name},
    }


@router.get("/google")
async def google_oauth_start():
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured.")

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "email profile https://www.googleapis.com/auth/gmail.send",
        "access_type": "offline",
        "prompt": "consent",  # force consent to always get refresh_token
    }
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    return RedirectResponse(url)


@router.get("/callback/google")
async def google_oauth_callback(
    code: Optional[str] = None,
    error: Optional[str] = None,
):
    if error or not code:
        return RedirectResponse(f"{FRONTEND_URL}/auth/login?error=google_cancelled")

    try:
        async with httpx.AsyncClient() as client:
            token_res = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
            )
            if token_res.status_code != 200:
                return RedirectResponse(f"{FRONTEND_URL}/auth/login?error=google_failed")

            token_data = token_res.json()
            google_token = token_data.get("access_token")

            user_res = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {google_token}"},
            )
            if user_res.status_code != 200:
                return RedirectResponse(f"{FRONTEND_URL}/auth/login?error=google_failed")

            user_info = user_res.json()
    except Exception:
        return RedirectResponse(f"{FRONTEND_URL}/auth/login?error=google_failed")

    email: str = user_info.get("email", "")
    name: str = user_info.get("name", email.split("@")[0] if email else "User")

    if not email:
        return RedirectResponse(f"{FRONTEND_URL}/auth/login?error=google_no_email")

    # Store refresh token so we can send Gmail on behalf of the user
    refresh_token = token_data.get("refresh_token")
    if refresh_token:
        save_google_refresh_token(email, refresh_token)

    jwt_token = jwt.encode(
        {
            "sub": email,
            "name": name,
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(days=JWT_TTL_DAYS),
        },
        JWT_SECRET,
        algorithm="HS256",
    )

    return RedirectResponse(f"{FRONTEND_URL}/auth/google-callback?token={jwt_token}")
