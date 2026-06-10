"""Repository: credit purchase waitlist."""

from db.database import get_db


def add_to_waitlist(email: str) -> bool:
    """Insert email into waitlist. Returns True if newly added, False if already present."""
    with get_db() as conn:
        row = conn.execute(
            """
            INSERT INTO credit_waitlist (email)
            VALUES (%s)
            ON CONFLICT (email) DO NOTHING
            RETURNING id
            """,
            (email,),
        ).fetchone()
        return row is not None


def get_waitlist(limit: int = 500, offset: int = 0) -> list[dict]:
    """Return waitlist entries ordered by sign-up date (newest first)."""
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT id, email, created_at
            FROM credit_waitlist
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
            """,
            (limit, offset),
        ).fetchall()
        return [dict(r) for r in rows]


def get_waitlist_count() -> int:
    """Return total number of waitlist entries."""
    with get_db() as conn:
        row = conn.execute("SELECT COUNT(*) AS cnt FROM credit_waitlist").fetchone()
        return row["cnt"] if row else 0
