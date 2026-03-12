"""SMTP email sender using aiosmtplib."""

import email.mime.text
import email.mime.multipart
import email.mime.base
import email.encoders
from pathlib import Path
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
    lines = [
        "Dear Hiring Manager,",
        "",
        f"My name is {name_full} and I am interested in the \u00ab{job_title}\u00bb "
        f"position at {company}.",
        "",
        "My experience and skills are detailed in my attached CV.",
    ]

    contact_lines = [f"Email: {profile.email}"]
    if profile.phone:
        contact_lines.append(f"Phone: {profile.phone}")
    if profile.linkedin_url:
        contact_lines.append(f"LinkedIn: {profile.linkedin_url}")
    if profile.portfolio_url:
        contact_lines.append(f"Portfolio: {profile.portfolio_url}")

    lines.extend(["", "Contact details:", *contact_lines, "", "Best regards,", name_full])
    return "\n".join(lines)


def build_default_subject(job_title: str, profile: UserProfile) -> str:
    name_full = f"{profile.name} {profile.surname}".strip()
    return f"Job application: {job_title} \u2014 {name_full}"


async def send_application_email(
    smtp: SMTPSettings,
    profile: UserProfile,
    to_email: str,
    job_title: str,
    company: str,
    cv_url: Optional[str],
    cv_path: Optional[Path] = None,
    extra_cv_paths: Optional[list] = None,
    custom_subject: Optional[str] = None,
    custom_body: Optional[str] = None,
) -> None:
    subject = custom_subject or build_default_subject(job_title, profile)
    body = custom_body or build_email_body(profile, job_title, company, cv_url)

    name_full = f"{profile.name} {profile.surname}".strip()

    msg = email.mime.multipart.MIMEMultipart()
    # Send FROM the authenticated SMTP account (must match for Gmail)
    # TODO: AFTER PROD. ACTIVE THIS
    # msg["From"] = f"{name_full} <{smtp.username}>"
    msg["From"] = f"Test <{smtp.username}>"
    # Only add Reply-To when the SMTP sender differs from the applicant's email
    # (e.g. sending via system account) so replies still reach the right person.
    # When using the user's own SMTP, From already IS their address — no need.
    # if profile.email and profile.email.lower() != smtp.username.lower():
    #     msg["Reply-To"] = profile.email
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(email.mime.text.MIMEText(body, "plain", "utf-8"))

    def _attach_file(path: Path) -> None:
        if not path.exists():
            return
        with open(path, "rb") as f:
            file_data = f.read()
        part = email.mime.base.MIMEBase("application", "octet-stream")
        part.set_payload(file_data)
        email.encoders.encode_base64(part)
        part.add_header("Content-Disposition", "attachment", filename=path.name)
        msg.attach(part)

    if cv_path:
        _attach_file(cv_path)
    for path in (extra_cv_paths or []):
        _attach_file(path)

    await aiosmtplib.send(
        msg,
        hostname=smtp.host,
        port=smtp.port,
        username=smtp.username,
        password=smtp.password or "",
        start_tls=True,
    )
