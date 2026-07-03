"""Repository: Gumroad purchase ledger + atomic credit grant."""

from db.database import get_db
from repositories.credits_repo import DEFAULT_CREDITS


def credit_if_new(sale_id: str, email: str, permalink: str, credits: int) -> bool:
    """Record a Gumroad sale and grant its credits, atomically and exactly once.

    Returns True if this sale was newly processed (credits granted), False if the
    sale_id was already recorded (a retried/duplicate Ping — nothing granted).
    """
    with get_db() as conn:
        recorded = conn.execute(
            """
            INSERT INTO gumroad_purchases (sale_id, email, permalink, credits)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (sale_id) DO NOTHING
            RETURNING sale_id
            """,
            (sale_id, email, permalink, credits),
        ).fetchone()

        if recorded is None:
            return False  # already processed — do not credit again

        # Same transaction: ensure the user's credit row exists, then grant.
        conn.execute(
            """
            INSERT INTO user_credits (email, credits, max_credits)
            VALUES (%s, %s, %s)
            ON CONFLICT (email) DO NOTHING
            """,
            (email, DEFAULT_CREDITS, DEFAULT_CREDITS),
        )
        conn.execute(
            """
            UPDATE user_credits
            SET credits = credits + %s, updated_at = NOW()
            WHERE email = %s
            """,
            (credits, email),
        )
        return True
