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

GMAIL_USER = os.getenv("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "").replace(" ", "")

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
    msg["From"] = GMAIL_USER
    msg["To"] = GMAIL_USER
    msg["Subject"] = subject
    if payload.email:
        msg["Reply-To"] = payload.email
    msg.attach(MIMEText(body, "plain"))

    try:
        await aiosmtplib.send(
            msg,
            hostname="smtp.gmail.com",
            port=465,
            use_tls=True,
            username=GMAIL_USER,
            password=GMAIL_APP_PASSWORD,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to send feedback email.") from exc

    return {"ok": True}
