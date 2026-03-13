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

ROOT_ENV_PATH = Path(__file__).resolve().parent.parent.parent.parent / ".env"

if ROOT_ENV_PATH.exists():
    load_dotenv(dotenv_path=ROOT_ENV_PATH)
         
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
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:32px 16px;background:#f1f3f9;font-family:'Inter','Avenir Next',sans-serif">
      <div style="max-width:460px;margin:0 auto;background:#ffffff;border-radius:8px;
                  border:1px solid #e1e5ee;overflow:hidden">

        <!-- Header -->
        <div style="padding:28px 32px 24px;border-bottom:1px solid #e1e5ee">
          <span style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
                       color:#7b7cff">JobClawd</span>
        </div>

        <!-- Body -->
        <div style="padding:32px">
          <h2 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#0e0f14;letter-spacing:-.01em">
            Your sign-in link
          </h2>
          <p style="margin:0 0 28px;font-size:14px;color:#5b6275;line-height:1.65">
            Click the button below to sign in to your JobClawd account.<br>
            This link expires in <strong style="color:#0e0f14;font-weight:600">{TOKEN_TTL_MINUTES} minutes</strong>
            and can only be used once.
          </p>

          <a href="{magic_url}"
             style="display:inline-block;background:#7b7cff;color:#ffffff;
                    padding:13px 28px;border-radius:5px;text-decoration:none;
                    font-size:14px;font-weight:700;letter-spacing:.01em">
            Sign in to JobClawd →
          </a>
        </div>

        <!-- Footer -->
        <div style="padding:20px 32px;border-top:1px solid #e1e5ee;background:#f8f9fd">
          <p style="margin:0;font-size:12px;color:#a9b0c2;line-height:1.6">
            If you did not request this email, you can safely ignore it.
          </p>
        </div>

      </div>
    </body>
    </html>
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
        "scope": "email profile",
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

    jwt_token = _issue_jwt(email, name)
    return f"{FRONTEND_URL}/auth/google-callback?token={jwt_token}"
