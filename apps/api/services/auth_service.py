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

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER", os.getenv("GMAIL_USER", ""))
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", os.getenv("GMAIL_APP_PASSWORD", "")).replace(" ", "")
MAIL_FROM = os.getenv("MAIL_FROM", SMTP_USER)
SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL", SMTP_USER)
JWT_SECRET = os.getenv("JWT_SECRET", "changeme-local-dev-only")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/callback/google")


def _provision_user(email: str) -> None:
    """Idempotently ensure profile and credits rows exist for a user."""
    with get_db() as db:
        db.execute(
            "INSERT INTO profiles (email, data) VALUES (%s, '{}'::jsonb) ON CONFLICT (email) DO NOTHING",
            (email,),
        )
        db.execute(
            "INSERT INTO user_credits (email, credits, max_credits) VALUES (%s, 10, 10) ON CONFLICT (email) DO NOTHING",
            (email,),
        )


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
    if not SMTP_USER or not SMTP_PASSWORD:
        raise RuntimeError("Server email is not configured. Contact the administrator.")

    magic_url = f"{FRONTEND_URL}/auth/verify?token={token}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "JobClawd — Sign-in link"
    msg["From"] = f"JobClawd <{MAIL_FROM}>"
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
        hostname=SMTP_HOST,
        port=SMTP_PORT,
        use_tls=True,
        username=SMTP_USER,
        password=SMTP_PASSWORD,
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
    _provision_user(email)
    name = email.split("@")[0]
    access_token = _issue_jwt(email, name)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"email": email, "name": name},
    }


EMAIL_CHANGE_TTL_MINUTES = 30
REAUTH_CODE_TTL_MINUTES = 15
REVERT_TTL_DAYS = 7


# ── Re-auth OTP ───────────────────────────────────────────────────────────────

def create_reauth_code(email: str) -> str:
    """Generate a 6-digit OTP and store it, replacing any prior code for this email."""
    code = str(secrets.randbelow(1_000_000)).zfill(6)
    expires_at = datetime.utcnow() + timedelta(minutes=REAUTH_CODE_TTL_MINUTES)
    with get_db() as db:
        db.execute("DELETE FROM email_reauth_codes WHERE email = %s", (email,))
        db.execute(
            "INSERT INTO email_reauth_codes (email, code, expires_at) VALUES (%s, %s, %s)",
            (email, code, expires_at),
        )
    return code


async def send_reauth_code_email(email: str, code: str) -> None:
    if not SMTP_USER or not SMTP_PASSWORD:
        raise RuntimeError("Server email is not configured.")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "JobClawd — Your verification code"
    msg["From"] = f"JobClawd <{MAIL_FROM}>"
    msg["To"] = email

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:32px 16px;background:#f1f3f9;font-family:'Inter','Avenir Next',sans-serif">
      <div style="max-width:460px;margin:0 auto;background:#ffffff;border-radius:8px;
                  border:1px solid #e1e5ee;overflow:hidden">
        <div style="padding:28px 32px 24px;border-bottom:1px solid #e1e5ee">
          <span style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#7b7cff">JobClawd</span>
        </div>
        <div style="padding:32px">
          <h2 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#0e0f14;letter-spacing:-.01em">
            Verify it's you
          </h2>
          <p style="margin:0 0 24px;font-size:14px;color:#5b6275;line-height:1.65">
            Use this code to confirm your identity before changing your email address.
            It expires in <strong style="color:#0e0f14">{REAUTH_CODE_TTL_MINUTES} minutes</strong>.
          </p>
          <div style="background:#f4f5fb;border-radius:8px;padding:20px 24px;text-align:center;
                      letter-spacing:.35em;font-size:32px;font-weight:700;color:#0e0f14;
                      font-family:'Courier New',monospace">
            {code}
          </div>
        </div>
        <div style="padding:20px 32px;border-top:1px solid #e1e5ee;background:#f8f9fd">
          <p style="margin:0;font-size:12px;color:#a9b0c2;line-height:1.6">
            If you did not request this, you can safely ignore this email.
          </p>
        </div>
      </div>
    </body>
    </html>
    """
    msg.attach(MIMEText(html_body, "html"))
    await aiosmtplib.send(
        msg, hostname=SMTP_HOST, port=SMTP_PORT,
        use_tls=True, username=SMTP_USER, password=SMTP_PASSWORD,
    )


# ── Email change request ──────────────────────────────────────────────────────

def create_email_change_request(old_email: str, new_email: str, otp: str) -> str:
    """Verify the OTP then store a pending email-change token. Atomic."""
    new_email = new_email.strip().lower()

    if "@" not in new_email or "." not in new_email.split("@")[-1]:
        raise ValueError("Invalid email address.")

    if new_email == old_email.strip().lower():
        raise ValueError("New email must be different from your current email.")

    with get_db() as db:
        # Verify OTP within the same transaction
        code_row = db.execute(
            """SELECT * FROM email_reauth_codes
               WHERE email = %s AND used = FALSE
               ORDER BY created_at DESC LIMIT 1""",
            (old_email,),
        ).fetchone()
        if not code_row or code_row["code"] != otp:
            raise ValueError("Invalid verification code.")
        otp_expires = code_row["expires_at"]
        if isinstance(otp_expires, str):
            otp_expires = datetime.fromisoformat(otp_expires)
        if datetime.utcnow() > otp_expires.replace(tzinfo=None):
            db.execute("DELETE FROM email_reauth_codes WHERE email = %s", (old_email,))
            raise ValueError("Verification code has expired. Please request a new one.")

        taken = db.execute(
            "SELECT 1 FROM profiles WHERE LOWER(email) = %s",
            (new_email,),
        ).fetchone()
        if taken:
            raise ValueError("This email is already associated with another account.")

        # Consume OTP and create change request atomically
        db.execute("UPDATE email_reauth_codes SET used = TRUE WHERE id = %s", (code_row["id"],))

        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(minutes=EMAIL_CHANGE_TTL_MINUTES)
        db.execute("DELETE FROM email_change_requests WHERE old_email = %s", (old_email,))
        db.execute(
            "INSERT INTO email_change_requests (old_email, new_email, token, expires_at) VALUES (%s, %s, %s, %s)",
            (old_email, new_email, token, expires_at),
        )
    return token


async def send_email_change_verification(new_email: str, old_email: str, token: str) -> None:
    """Send the verification link to the NEW address."""
    if not SMTP_USER or not SMTP_PASSWORD:
        raise RuntimeError("Server email is not configured.")

    verify_url = f"{FRONTEND_URL}/auth/verify-email-change?token={token}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "JobClawd — Verify your new email address"
    msg["From"] = f"JobClawd <{MAIL_FROM}>"
    msg["To"] = new_email

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:32px 16px;background:#f1f3f9;font-family:'Inter','Avenir Next',sans-serif">
      <div style="max-width:460px;margin:0 auto;background:#ffffff;border-radius:8px;
                  border:1px solid #e1e5ee;overflow:hidden">
        <div style="padding:28px 32px 24px;border-bottom:1px solid #e1e5ee">
          <span style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#7b7cff">JobClawd</span>
        </div>
        <div style="padding:32px">
          <h2 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#0e0f14;letter-spacing:-.01em">
            Verify your new email
          </h2>
          <p style="margin:0 0 6px;font-size:14px;color:#5b6275;line-height:1.65">
            You requested to change your JobClawd account email from
            <strong style="color:#0e0f14">{old_email}</strong> to
            <strong style="color:#0e0f14">{new_email}</strong>.
          </p>
          <p style="margin:0 0 28px;font-size:14px;color:#5b6275;line-height:1.65">
            Click the button below to confirm. This link expires in
            <strong style="color:#0e0f14">{EMAIL_CHANGE_TTL_MINUTES} minutes</strong>
            and can only be used once.
          </p>
          <a href="{verify_url}"
             style="display:inline-block;background:#7b7cff;color:#ffffff;
                    padding:13px 28px;border-radius:5px;text-decoration:none;
                    font-size:14px;font-weight:700;letter-spacing:.01em">
            Confirm new email →
          </a>
        </div>
        <div style="padding:20px 32px;border-top:1px solid #e1e5ee;background:#f8f9fd">
          <p style="margin:0;font-size:12px;color:#a9b0c2;line-height:1.6">
            If you did not request this change, you can safely ignore this email.
            Your current email address will remain unchanged.
          </p>
        </div>
      </div>
    </body>
    </html>
    """
    msg.attach(MIMEText(html_body, "html"))
    await aiosmtplib.send(
        msg, hostname=SMTP_HOST, port=SMTP_PORT,
        use_tls=True, username=SMTP_USER, password=SMTP_PASSWORD,
    )


async def send_email_change_notification(old_email: str, new_email: str, revert_token: str) -> None:
    """Notify the OLD address that the email changed, with a revert link (best-effort)."""
    if not SMTP_USER or not SMTP_PASSWORD:
        return

    revert_url = f"{FRONTEND_URL}/auth/revert-email-change?token={revert_token}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "JobClawd — Your email address has been changed"
    msg["From"] = f"JobClawd <{MAIL_FROM}>"
    msg["To"] = old_email

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:32px 16px;background:#f1f3f9;font-family:'Inter','Avenir Next',sans-serif">
      <div style="max-width:460px;margin:0 auto;background:#ffffff;border-radius:8px;
                  border:1px solid #e1e5ee;overflow:hidden">
        <div style="padding:28px 32px 24px;border-bottom:1px solid #e1e5ee">
          <span style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#7b7cff">JobClawd</span>
        </div>
        <div style="padding:32px">
          <h2 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#0e0f14">
            Email address changed
          </h2>
          <p style="margin:0 0 20px;font-size:14px;color:#5b6275;line-height:1.65">
            The email address on your JobClawd account was changed to
            <strong style="color:#0e0f14">{new_email}</strong>.
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#5b6275;line-height:1.65">
            If this was you, no action is needed. If you <strong style="color:#0e0f14">didn't make this change</strong>,
            click the button below within <strong style="color:#0e0f14">{REVERT_TTL_DAYS} days</strong> to revert it immediately.
          </p>
          <a href="{revert_url}"
             style="display:inline-block;background:#e53e3e;color:#ffffff;
                    padding:13px 28px;border-radius:5px;text-decoration:none;
                    font-size:14px;font-weight:700;letter-spacing:.01em">
            Revert email change →
          </a>
        </div>
        <div style="padding:20px 32px;border-top:1px solid #e1e5ee;background:#f8f9fd">
          <p style="margin:0;font-size:12px;color:#a9b0c2;line-height:1.6">
            This is an automated security notification from JobClawd.
            The revert link expires in {REVERT_TTL_DAYS} days.
          </p>
        </div>
      </div>
    </body>
    </html>
    """
    msg.attach(MIMEText(html_body, "html"))
    try:
        await aiosmtplib.send(
            msg, hostname=SMTP_HOST, port=SMTP_PORT,
            use_tls=True, username=SMTP_USER, password=SMTP_PASSWORD,
        )
    except Exception:
        pass  # best-effort


def verify_email_change(token: str) -> dict:
    """
    Validate the token, migrate ALL user data to the new email in one transaction,
    and issue a fresh JWT. Atomic — partial migration is impossible.
    """
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM email_change_requests WHERE token = %s AND used = FALSE",
            (token,),
        ).fetchone()

        if not row:
            raise ValueError("Invalid or already used link.")

        expires_at = row["expires_at"]
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if datetime.utcnow() > expires_at.replace(tzinfo=None):
            db.execute("DELETE FROM email_change_requests WHERE token = %s", (token,))
            raise ValueError("Link has expired. Please request a new email change.")

        old_email: str = row["old_email"]
        new_email: str = row["new_email"]

        # Mark used before migration to prevent replay on concurrent requests
        db.execute("UPDATE email_change_requests SET used = TRUE WHERE token = %s", (token,))

        # ── Migrate all email-keyed rows atomically ───────────────────────
        db.execute("UPDATE profiles            SET email      = %s WHERE email      = %s", (new_email, old_email))
        db.execute("UPDATE user_credits        SET email      = %s WHERE email      = %s", (new_email, old_email))
        db.execute("UPDATE saved_vacancies     SET user_email = %s WHERE user_email = %s", (new_email, old_email))
        db.execute("UPDATE cv_analysis_cache   SET email      = %s WHERE email      = %s", (new_email, old_email))
        db.execute("UPDATE cv_analysis_events  SET user_email = %s WHERE user_email = %s", (new_email, old_email))
        db.execute("UPDATE suggestion_events   SET user_email = %s WHERE user_email = %s", (new_email, old_email))
        db.execute("UPDATE impact_check_events SET user_email = %s WHERE user_email = %s", (new_email, old_email))
        db.execute("UPDATE apply_click_events  SET user_email = %s WHERE user_email = %s", (new_email, old_email))

        # Invalidate all existing sessions for the old email
        db.execute("DELETE FROM auth_tokens WHERE email = %s", (old_email,))

        # Store a revert token so the old address can undo within REVERT_TTL_DAYS
        revert_token = secrets.token_urlsafe(32)
        revert_expires_at = datetime.utcnow() + timedelta(days=REVERT_TTL_DAYS)
        db.execute(
            "INSERT INTO email_revert_tokens (old_email, new_email, token, expires_at) VALUES (%s, %s, %s, %s)",
            (old_email, new_email, revert_token, revert_expires_at),
        )

    name = new_email.split("@")[0]
    access_token = _issue_jwt(new_email, name)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"email": new_email, "name": name},
        "old_email": old_email,
        "revert_token": revert_token,
    }


def revert_email_change(token: str) -> dict:
    """Atomically migrate all data back to old_email and issue a new JWT."""
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM email_revert_tokens WHERE token = %s AND used = FALSE",
            (token,),
        ).fetchone()
        if not row:
            raise ValueError("Invalid or already used revert link.")

        expires_at = row["expires_at"]
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if datetime.utcnow() > expires_at.replace(tzinfo=None):
            db.execute("DELETE FROM email_revert_tokens WHERE token = %s", (token,))
            raise ValueError("Revert link has expired.")

        old_email: str = row["old_email"]
        new_email: str = row["new_email"]

        # Ensure the account still exists under new_email before reverting
        still_exists = db.execute(
            "SELECT 1 FROM profiles WHERE LOWER(email) = %s", (new_email.lower(),)
        ).fetchone()
        if not still_exists:
            raise ValueError("Account state has changed and cannot be reverted automatically.")

        db.execute("UPDATE email_revert_tokens SET used = TRUE WHERE token = %s", (token,))

        db.execute("UPDATE profiles            SET email      = %s WHERE email      = %s", (old_email, new_email))
        db.execute("UPDATE user_credits        SET email      = %s WHERE email      = %s", (old_email, new_email))
        db.execute("UPDATE saved_vacancies     SET user_email = %s WHERE user_email = %s", (old_email, new_email))
        db.execute("UPDATE cv_analysis_cache   SET email      = %s WHERE email      = %s", (old_email, new_email))
        db.execute("UPDATE cv_analysis_events  SET user_email = %s WHERE user_email = %s", (old_email, new_email))
        db.execute("UPDATE suggestion_events   SET user_email = %s WHERE user_email = %s", (old_email, new_email))
        db.execute("UPDATE impact_check_events SET user_email = %s WHERE user_email = %s", (old_email, new_email))
        db.execute("UPDATE apply_click_events  SET user_email = %s WHERE user_email = %s", (old_email, new_email))

        db.execute("DELETE FROM auth_tokens WHERE email = %s", (new_email,))

    name = old_email.split("@")[0]
    access_token = _issue_jwt(old_email, name)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"email": old_email, "name": name},
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

    _provision_user(email)
    jwt_token = _issue_jwt(email, name)
    return f"{FRONTEND_URL}/auth/google-callback?token={jwt_token}"
