import json
from typing import Optional

from db.database import get_db


def get_profile(email: str) -> Optional[dict]:
    with get_db() as db:
        row = db.execute(
            "SELECT data FROM profiles WHERE email = ?", (email,)
        ).fetchone()
    if row:
        return json.loads(row["data"])
    return None


def save_profile(email: str, data: dict) -> None:
    with get_db() as db:
        db.execute(
            "INSERT INTO profiles (email, data) VALUES (?, ?) "
            "ON CONFLICT(email) DO UPDATE SET data = excluded.data, updated_at = datetime('now')",
            (email, json.dumps(data)),
        )
