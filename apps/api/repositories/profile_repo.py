import json
from typing import Optional

from db.database import get_db


def get_profile(email: str) -> Optional[dict]:
    with get_db() as db:
        row = db.execute(
            "SELECT data FROM profiles WHERE email = %s", (email,)
        ).fetchone()
    if row:
        data = row["data"]
        # psycopg2 returns JSONB columns as already-parsed dicts
        if isinstance(data, str):
            return json.loads(data)
        return data
    return None


def save_profile(email: str, data: dict) -> None:
    with get_db() as db:
        db.execute(
            "INSERT INTO profiles (email, data) VALUES (%s, %s::jsonb) "
            "ON CONFLICT (email) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()",
            (email, json.dumps(data)),
        )


def delete_account(email: str) -> None:
    """Delete all data associated with the given user email."""
    with get_db() as db:
        db.execute("DELETE FROM profiles WHERE email = %s", (email,))
        # Delete per-user settings (for example stored OAuth tokens).
        db.execute("DELETE FROM settings WHERE key LIKE %s", (f"%_{email}",))
        # Delete the user's stored OpenAI API key.
        db.execute("DELETE FROM user_api_keys WHERE email = %s", (email,))
