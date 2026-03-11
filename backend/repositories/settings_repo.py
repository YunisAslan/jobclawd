"""
Repository: read/write app settings from the key-value settings table.
No business logic — pure data access.
"""
import json
from typing import Optional

from db.database import get_db
from models.schemas import SMTPSettings


def _smtp_key(user_email: Optional[str]) -> str:
    return f"smtp_config_{user_email}" if user_email else "smtp_config"


def get_smtp_config(user_email: Optional[str] = None) -> Optional[SMTPSettings]:
    key = _smtp_key(user_email)
    with get_db() as conn:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = %s", (key,)
        ).fetchone()
    if not row:
        return None
    return SMTPSettings(**json.loads(row["value"]))


def delete_smtp_config(user_email: Optional[str] = None) -> None:
    key = _smtp_key(user_email)
    with get_db() as conn:
        conn.execute("DELETE FROM settings WHERE key = %s", (key,))


def save_smtp_config(settings: SMTPSettings, user_email: Optional[str] = None) -> None:
    key = _smtp_key(user_email)
    with get_db() as conn:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (%s, %s) "
            "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            (key, json.dumps(settings.model_dump())),
        )


def save_google_refresh_token(user_email: str, refresh_token: str) -> None:
    key = f"google_refresh_token_{user_email}"
    with get_db() as conn:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (%s, %s) "
            "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            (key, refresh_token),
        )


def get_google_refresh_token(user_email: str) -> Optional[str]:
    key = f"google_refresh_token_{user_email}"
    with get_db() as conn:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = %s", (key,)
        ).fetchone()
    return row["value"] if row else None


def get_autopilot_enabled() -> bool:
    with get_db() as conn:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = 'autopilot_enabled'"
        ).fetchone()
    return row["value"] == "true" if row else False


def save_autopilot_enabled(enabled: bool) -> None:
    with get_db() as conn:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('autopilot_enabled', %s) "
            "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            ("true" if enabled else "false",),
        )
