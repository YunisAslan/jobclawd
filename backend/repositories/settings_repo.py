"""
Repository: read/write app settings from the key-value settings table.
No business logic — pure data access.
"""
import json
from typing import Optional

from db.database import get_db
from models.schemas import SMTPSettings


def get_smtp_config() -> Optional[SMTPSettings]:
    with get_db() as conn:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = 'smtp_config'"
        ).fetchone()
    if not row:
        return None
    return SMTPSettings(**json.loads(row["value"]))


def save_smtp_config(settings: SMTPSettings) -> None:
    with get_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('smtp_config', ?)",
            (json.dumps(settings.model_dump()),),
        )


def get_autopilot_enabled() -> bool:
    with get_db() as conn:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = 'autopilot_enabled'"
        ).fetchone()
    return row["value"] == "true" if row else False


def save_autopilot_enabled(enabled: bool) -> None:
    with get_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('autopilot_enabled', ?)",
            ("true" if enabled else "false",),
        )
