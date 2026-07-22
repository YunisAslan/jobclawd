"""Repository: per-user OpenAI API keys (encrypted at rest)."""

from db.database import get_db


def set_key(email: str, encrypted_key: str, key_hint: str) -> None:
    """Store (or replace) a user's encrypted OpenAI key."""
    with get_db() as db:
        db.execute(
            """
            INSERT INTO user_api_keys (email, openai_key, key_hint)
            VALUES (%s, %s, %s)
            ON CONFLICT (email) DO UPDATE
              SET openai_key = EXCLUDED.openai_key,
                  key_hint   = EXCLUDED.key_hint,
                  updated_at = NOW()
            """,
            (email, encrypted_key, key_hint),
        )


def get_key_row(email: str) -> dict | None:
    """Return the raw row {openai_key, key_hint} for a user, or None."""
    with get_db() as db:
        row = db.execute(
            "SELECT openai_key, key_hint FROM user_api_keys WHERE email = %s",
            (email,),
        ).fetchone()
    return dict(row) if row else None


def delete_key(email: str) -> None:
    with get_db() as db:
        db.execute("DELETE FROM user_api_keys WHERE email = %s", (email,))
