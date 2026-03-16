"""Repository: per-user search credits."""

from db.database import get_db

DEFAULT_CREDITS = 10


def ensure_credits(email: str) -> dict:
    """Return the user's credit row, creating it with defaults if absent."""
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO user_credits (email, credits, max_credits)
            VALUES (%s, %s, %s)
            ON CONFLICT (email) DO NOTHING
            """,
            (email, DEFAULT_CREDITS, DEFAULT_CREDITS),
        )
        row = conn.execute(
            "SELECT credits, max_credits FROM user_credits WHERE email = %s",
            (email,),
        ).fetchone()
        return dict(row)


def get_credits(email: str) -> dict:
    """Get current credits for a user."""
    return ensure_credits(email)


def use_credit(email: str) -> bool:
    """Decrement one credit. Returns True if successful, False if out of credits."""
    with get_db() as conn:
        # Ensure row exists
        conn.execute(
            """
            INSERT INTO user_credits (email, credits, max_credits)
            VALUES (%s, %s, %s)
            ON CONFLICT (email) DO NOTHING
            """,
            (email, DEFAULT_CREDITS, DEFAULT_CREDITS),
        )
        row = conn.execute(
            """
            UPDATE user_credits
            SET credits = credits - 1, updated_at = NOW()
            WHERE email = %s AND credits > 0
            RETURNING credits
            """,
            (email,),
        ).fetchone()
        return row is not None
