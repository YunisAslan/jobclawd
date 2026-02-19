"""SMTP email sender using aiosmtplib."""

import email.mime.text
import email.mime.multipart
from typing import Optional
import aiosmtplib
from models.schemas import SMTPSettings, UserProfile


def build_email_body(
    profile: UserProfile,
    job_title: str,
    company: str,
    cv_url: Optional[str],
) -> str:
    name_full = f"{profile.name} {profile.surname}".strip()
    cv_line = f"\nCV linkim: {cv_url}" if cv_url else ""
    return (
        f"Hörmətli HR meneceri,\n\n"
        f"Mən {name_full}, {company} şirkətinizdə elan etdiyiniz «{job_title}» "
        f"vakansiyası ilə maraqlanıram.\n\n"
        f"Təcrübəm və bacarıqlarım barədə ətraflı məlumatı CV-də qeyd etmişəm.{cv_line}\n\n"
        f"Əlaqə məlumatlarım:\n"
        f"Telefon: {profile.phone}\n"
        f"Email: {profile.email}\n\n"
        f"Hörmətlə,\n{name_full}"
    )


async def send_application_email(
    smtp: SMTPSettings,
    profile: UserProfile,
    to_email: str,
    job_title: str,
    company: str,
    cv_url: Optional[str],
) -> None:
    name_full = f"{profile.name} {profile.surname}".strip()
    subject = f"Vakansiya müraciəti: {job_title} — {name_full}"
    body = build_email_body(profile, job_title, company, cv_url)

    msg = email.mime.multipart.MIMEMultipart()
    msg["From"] = f"{smtp.from_name} <{smtp.username}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(email.mime.text.MIMEText(body, "plain", "utf-8"))

    await aiosmtplib.send(
        msg,
        hostname=smtp.host,
        port=smtp.port,
        username=smtp.username,
        password=smtp.password or "",
        start_tls=True,
    )
