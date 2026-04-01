"""
Repository: CRUD + TTL cleanup for saved_vacancies table.
No business logic — pure data access.
"""
import json
from db.database import get_db


def save_vacancy(user_email: str, job_url: str, job_data: dict) -> int:
    """Upsert a saved vacancy. Returns the row id."""
    with get_db() as conn:
        row = conn.execute(
            """
            INSERT INTO saved_vacancies (user_email, job_url, job_data)
            VALUES (%s, %s, %s::jsonb)
            ON CONFLICT (user_email, job_url) DO UPDATE SET
                job_data   = EXCLUDED.job_data,
                expires_at = NOW() + INTERVAL '7 days'
            RETURNING id
            """,
            (user_email, job_url, json.dumps(job_data)),
        ).fetchone()
        return row["id"]


def unsave_vacancy(user_email: str, job_url: str) -> bool:
    """Delete a saved vacancy. Returns True if a row was deleted."""
    with get_db() as conn:
        cur = conn.execute(
            "DELETE FROM saved_vacancies WHERE user_email = %s AND job_url = %s",
            (user_email, job_url),
        )
        return cur.rowcount > 0


def get_saved_vacancies(user_email: str) -> list[dict]:
    """Return all non-expired saved vacancies for a user, ordered by saved_at DESC."""
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT id, job_url, job_data, saved_at, expires_at
            FROM saved_vacancies
            WHERE user_email = %s AND expires_at > NOW()
            ORDER BY saved_at DESC
            """,
            (user_email,),
        ).fetchall()
        result = []
        for r in rows:
            job_data = r["job_data"]
            if isinstance(job_data, str):
                job_data = json.loads(job_data)
            result.append({
                "id": r["id"],
                "job_url": r["job_url"],
                "job_data": job_data,
                "saved_at": r["saved_at"].isoformat() if hasattr(r["saved_at"], "isoformat") else str(r["saved_at"]),
                "expires_at": r["expires_at"].isoformat() if hasattr(r["expires_at"], "isoformat") else str(r["expires_at"]),
            })
        return result


def check_saved_urls(user_email: str, job_urls: list[str]) -> list[str]:
    """Return the subset of job_urls that are saved (non-expired) for this user."""
    if not job_urls:
        return []
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT job_url FROM saved_vacancies
            WHERE user_email = %s AND job_url = ANY(%s) AND expires_at > NOW()
            """,
            (user_email, job_urls),
        ).fetchall()
        return [r["job_url"] for r in rows]


def delete_expired_saved_vacancies() -> int:
    """Delete all expired saved vacancies. Called by the background cleanup task."""
    with get_db() as conn:
        cur = conn.execute("DELETE FROM saved_vacancies WHERE expires_at <= NOW()")
        return cur.rowcount
