import os
import secrets
from datetime import datetime, timedelta
from pathlib import Path

import aiosmtplib
import httpx
import jwt
from dotenv import load_dotenv
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from db.database import get_db
from repositories.settings_repo import save_google_refresh_token

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
TOKEN_TTL_MINUTES = 15
JWT_TTL_DAYS = 30

GMAIL_USER = os.getenv("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "").replace(" ", "")
JWT_SECRET = os.getenv("JWT_SECRET", "changeme-local-dev-only")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/callback/google")


def _issue_jwt(email: str, name: str) -> str:
    return jwt.encode(
        {
            "sub": email,
            "name": name,
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(days=JWT_TTL_DAYS),
        },
        JWT_SECRET,
        algorithm="HS256",
    )


def create_and_store_token(email: str) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.utcnow() + timedelta(minutes=TOKEN_TTL_MINUTES)).isoformat()

    with get_db() as db:
        db.execute("DELETE FROM auth_tokens WHERE email = %s", (email,))
        db.execute(
            "INSERT INTO auth_tokens (email, token, expires_at) VALUES (%s, %s, %s)",
            (email, token, expires_at),
        )
    return token


async def send_magic_link_email(email: str, token: str):
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        raise RuntimeError("Server email is not configured. Contact the administrator.")

    magic_url = f"{FRONTEND_URL}/auth/verify?token={token}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "JobClawd — Sign-in link"
    msg["From"] = f"JobClawd <{GMAIL_USER}>"
    msg["To"] = email

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

    await aiosmtplib.send(
        msg,
        hostname="smtp.gmail.com",
        port=587,
        start_tls=True,
        username=GMAIL_USER,
        password=GMAIL_APP_PASSWORD,
    )


def verify_token(token: str) -> dict:
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM auth_tokens WHERE token = %s AND used = FALSE",
            (token,),
        ).fetchone()

    if not row:
        raise ValueError("Invalid or already used link.")

    expires_at = row["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if datetime.utcnow() > expires_at.replace(tzinfo=None):
        with get_db() as db:
            db.execute("DELETE FROM auth_tokens WHERE token = %s", (token,))
        raise ValueError("Link has expired. Please request a new one.")

    with get_db() as db:
        db.execute("UPDATE auth_tokens SET used = TRUE WHERE token = %s", (token,))

    email: str = row["email"]
    name = email.split("@")[0]
    access_token = _issue_jwt(email, name)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"email": email, "name": name},
    }


def get_google_auth_url() -> str:
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise RuntimeError("Google OAuth is not configured.")

    import urllib.parse
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "email profile https://www.googleapis.com/auth/gmail.send",
        "access_type": "offline",
        "prompt": "consent",
    }
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)


async def handle_google_callback(code: str) -> str:
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
            raise RuntimeError("google_failed")

        token_data = token_res.json()
        google_token = token_data.get("access_token")

        user_res = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {google_token}"},
        )
        if user_res.status_code != 200:
            raise RuntimeError("google_failed")

        user_info = user_res.json()

    email: str = user_info.get("email", "")
    name: str = user_info.get("name", email.split("@")[0] if email else "User")

    if not email:
        raise RuntimeError("google_no_email")

    refresh_token = token_data.get("refresh_token")
    if refresh_token:
        save_google_refresh_token(email, refresh_token)

    jwt_token = _issue_jwt(email, name)
    return f"{FRONTEND_URL}/auth/google-callback?token={jwt_token}"
