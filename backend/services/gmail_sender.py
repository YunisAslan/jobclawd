"""
Gmail API sender — uses the user's OAuth refresh token to send email
on their behalf via the Gmail REST API. No manual configuration needed.
"""

import base64
import email.mime.base
import email.mime.multipart
import email.mime.text
import email.encoders
import os
from pathlib import Path
from typing import Optional

import httpx


async def _get_access_token(refresh_token: str) -> str:
    """Exchange refresh token for a fresh access token."""
    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": os.environ["GOOGLE_CLIENT_ID"],
                "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )
    data = res.json()
    if "access_token" not in data:
        raise RuntimeError(f"Failed to refresh Google token: {data.get('error_description', data)}")
    return data["access_token"]


async def send_via_gmail_api(
    from_email: str,
    from_name: str,
    to_email: str,
    subject: str,
    body: str,
    refresh_token: str,
    cv_path: Optional[Path] = None,
) -> None:
    """Send an email via Gmail API using the user's OAuth credentials."""
    msg = email.mime.multipart.MIMEMultipart()
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(email.mime.text.MIMEText(body, "plain", "utf-8"))

    if cv_path and cv_path.exists():
        with open(cv_path, "rb") as f:
            file_data = f.read()
        part = email.mime.base.MIMEBase("application", "octet-stream")
        part.set_payload(file_data)
        email.encoders.encode_base64(part)
        part.add_header("Content-Disposition", "attachment", filename=cv_path.name)
        msg.attach(part)

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")

    access_token = await _get_access_token(refresh_token)

    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
            headers={"Authorization": f"Bearer {access_token}"},
            json={"raw": raw},
        )

    if res.status_code not in (200, 201):
        raise RuntimeError(f"Gmail API error {res.status_code}: {res.text}")
