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
    return use_credits(email, 1)


def use_credits(email: str, amount: int) -> bool:
    """Decrement `amount` credits atomically. Returns True if successful, False if insufficient."""
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
            """
            UPDATE user_credits
            SET credits = credits - %s, updated_at = NOW()
            WHERE email = %s AND credits >= %s
            RETURNING credits
            """,
            (amount, email, amount),
        ).fetchone()
        return row is not None


def add_credits(email: str, amount: int) -> dict:
    """Add credits to a user's account. Creates the row if absent."""
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
            """
            UPDATE user_credits
            SET credits = credits + %s, updated_at = NOW()
            WHERE email = %s
            RETURNING credits, max_credits
            """,
            (amount, email),
        ).fetchone()
        return dict(row)
