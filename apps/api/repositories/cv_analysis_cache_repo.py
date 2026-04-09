"""Repository: CV match analysis + suggestions cache keyed by (email, cv_url, job_url)."""
import json
from datetime import datetime, timezone, timedelta
from typing import Optional

from db.database import get_db

_TTL_DAYS = 7


def get_cv_analysis(email: str, cv_url: str, job_url: str) -> Optional[dict]:
    """Return cached analysis + suggestions if a valid (non-expired) entry exists."""
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT analysis_json, suggestions_json, cv_name
            FROM cv_analysis_cache
            WHERE email = %s AND cv_url = %s AND job_url = %s
              AND expires_at > NOW()
            """,
            (email, cv_url, job_url),
        ).fetchone()

    if row is None:
        return None

    analysis = row["analysis_json"]
    suggestions = row["suggestions_json"]
    if isinstance(analysis, str):
        analysis = json.loads(analysis)
    if isinstance(suggestions, str):
        suggestions = json.loads(suggestions)

    return {
        "analysis": analysis,
        "suggestions": suggestions,
        "cv_name": row["cv_name"],
    }


def set_cv_analysis(
    email: str,
    cv_url: str,
    job_url: str,
    analysis: dict,
    suggestions: dict,
    cv_name: str = "",
) -> None:
    """Upsert a cache entry, resetting the TTL on conflict."""
    expires_at = datetime.now(timezone.utc) + timedelta(days=_TTL_DAYS)
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO cv_analysis_cache
                (email, cv_url, job_url, analysis_json, suggestions_json, cv_name, expires_at)
            VALUES (%s, %s, %s, %s::jsonb, %s::jsonb, %s, %s)
            ON CONFLICT (email, cv_url, job_url) DO UPDATE SET
                analysis_json    = EXCLUDED.analysis_json,
                suggestions_json = EXCLUDED.suggestions_json,
                cv_name          = EXCLUDED.cv_name,
                created_at       = NOW(),
                expires_at       = EXCLUDED.expires_at
            """,
            (
                email,
                cv_url,
                job_url,
                json.dumps(analysis),
                json.dumps(suggestions),
                cv_name,
                expires_at,
            ),
        )


def delete_expired_cv_analysis() -> int:
    """Delete all expired entries. Called by the background cleanup task."""
    with get_db() as conn:
        cur = conn.execute("DELETE FROM cv_analysis_cache WHERE expires_at <= NOW()")
        return cur.rowcount
