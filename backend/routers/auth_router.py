"""
Router: Magic link authentication endpoints.
POST /auth/send-magic-link  — generates token, sends email
GET  /auth/verify-magic-link — verifies token, returns user info
"""
import json
import secrets
from datetime import datetime, timedelta

import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db.database import get_db
from repositories import settings_repo

router = APIRouter(prefix="/auth", tags=["auth"])

FRONTEND_URL = "http://localhost:3000"
TOKEN_TTL_MINUTES = 15


class MagicLinkRequest(BaseModel):
    email: str


@router.post("/send-magic-link")
async def send_magic_link(body: MagicLinkRequest):
    smtp = settings_repo.get_smtp_config()
    if not smtp or not smtp.password:
        raise HTTPException(
            status_code=500,
            detail="SMTP konfiqurasiya edilməyib. Əvvəlcə tənzimləmələrdə SMTP-ni konfiqurasiya edin.",
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
    msg["Subject"] = "JobClawd — Giriş Linki"
    msg["From"] = f"{smtp.from_name} <{smtp.username}>"
    msg["To"] = body.email

    html_body = f"""
    <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;
                padding:40px 32px;background:#0a0a0a;color:#fff;border-radius:16px;
                border:1px solid rgba(255,255,255,0.08)">
      <p style="font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
                color:#10B981;margin:0 0 20px">JobClawd</p>
      <h2 style="color:#fff;font-size:22px;margin:0 0 12px">Giriş Linki</h2>
      <p style="color:#888;font-size:14px;margin:0 0 28px;line-height:1.6">
        Bu linki <strong style="color:#fff">{TOKEN_TTL_MINUTES} dəqiqə</strong> ərzində
        istifadə edin. Link yalnız bir dəfə işləyir.
      </p>
      <a href="{magic_url}"
         style="display:inline-block;background:#10B981;color:#fff;padding:14px 28px;
                border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
        Daxil ol →
      </a>
      <p style="color:#444;font-size:12px;margin:28px 0 0;line-height:1.6">
        Bu linki siz tələb etmədinizsə, bu e-poçtu nəzərə almayın.
      </p>
    </div>
    """

    msg.attach(MIMEText(html_body, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=smtp.host,
            port=smtp.port,
            start_tls=True,
            username=smtp.username,
            password=smtp.password,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"E-poçt göndərilə bilmədi: {exc}",
        )

    return {"success": True}


@router.get("/verify-magic-link")
async def verify_magic_link(token: str):
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM auth_tokens WHERE token = ? AND used = 0",
            (token,),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=400, detail="Etibarsız və ya artıq istifadə edilmiş link.")

    expires_at = datetime.fromisoformat(row["expires_at"])
    if datetime.utcnow() > expires_at:
        with get_db() as db:
            db.execute("DELETE FROM auth_tokens WHERE token = ?", (token,))
        raise HTTPException(status_code=400, detail="Linkin müddəti bitib. Yenidən cəhd edin.")

    with get_db() as db:
        db.execute("UPDATE auth_tokens SET used = 1 WHERE token = ?", (token,))

    email: str = row["email"]
    name = email.split("@")[0]
    return {"email": email, "name": name}
