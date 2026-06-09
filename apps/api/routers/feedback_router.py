import os
from pathlib import Path
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

ROOT_ENV_PATH = Path(__file__).resolve().parent.parent.parent.parent / ".env"
if ROOT_ENV_PATH.exists():
    load_dotenv(dotenv_path=ROOT_ENV_PATH)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER", os.getenv("GMAIL_USER", ""))
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", os.getenv("GMAIL_APP_PASSWORD", "")).replace(" ", "")
MAIL_FROM = os.getenv("MAIL_FROM", SMTP_USER)
SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL", SMTP_USER)

router = APIRouter()

class FeedbackPayload(BaseModel):
    message: str
    email: str | None = None


@router.post("/feedback")
async def submit_feedback(payload: FeedbackPayload):
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message is required.")

    subject = "[JobClawd] Feedback"

    body_lines = [
        f"From:     {payload.email or 'anonymous'}",
        "",
        "--- Message ---",
        payload.message.strip(),
    ]
    body = "\n".join(body_lines)

    msg = MIMEMultipart()
    msg["From"] = MAIL_FROM
    msg["To"] = SUPPORT_EMAIL
    msg["Subject"] = subject
    if payload.email:
        msg["Reply-To"] = payload.email
    msg.attach(MIMEText(body, "plain"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            use_tls=True,
            username=SMTP_USER,
            password=SMTP_PASSWORD,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to send feedback email.") from exc

    return {"ok": True}
