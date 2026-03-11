"""
Repository: read/write/expire search result cache in PostgreSQL.
No business logic — pure data access.
"""
import json
from datetime import datetime, timezone, timedelta
from typing import Optional

from db.database import get_db

CACHE_TTL_HOURS = 1


def get_cached_result(filters_hash: str) -> Optional[dict]:
    """
    Return the cached SearchResponse dict if a valid (non-expired) entry exists,
    otherwise return None.
    Also increments the hit counter as a lightweight telemetry signal.
    """
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT result_json
            FROM search_cache
            WHERE filters_hash = %s
              AND expires_at > NOW()
            """,
            (filters_hash,),
        ).fetchone()

        if row is None:
            return None

        # Fire-and-forget hit counter update (same transaction is fine here)
        conn.execute(
            "UPDATE search_cache SET hit_count = hit_count + 1 WHERE filters_hash = %s",
            (filters_hash,),
        )

    # psycopg2 with RealDictCursor returns JSONB columns already parsed as dicts
    result = row["result_json"]
    if isinstance(result, str):
        result = json.loads(result)
    return result


def set_cached_result(
    filters_hash: str,
    filters_dict: dict,
    result: dict,
    job_count: int,
) -> None:
    """
    Upsert a cache entry.
    ON CONFLICT updates the payload and resets TTL — handles the rare race where
    two workers finish a scrape for identical filters at nearly the same time.
    """
    expires_at = datetime.now(timezone.utc) + timedelta(hours=CACHE_TTL_HOURS)

    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO search_cache
                (filters_hash, filters_json, result_json, job_count, expires_at)
            VALUES (%s, %s::jsonb, %s::jsonb, %s, %s)
            ON CONFLICT (filters_hash) DO UPDATE SET
                result_json = EXCLUDED.result_json,
                job_count   = EXCLUDED.job_count,
                created_at  = NOW(),
                expires_at  = EXCLUDED.expires_at,
                hit_count   = 0
            """,
            (
                filters_hash,
                json.dumps(filters_dict),
                json.dumps(result),
                job_count,
                expires_at,
            ),
        )


def delete_expired_cache() -> int:
    """
    Delete all expired cache rows. Called by the background cleanup task.
    Returns the number of rows deleted.
    """
    with get_db() as conn:
        cur = conn.execute("DELETE FROM search_cache WHERE expires_at <= NOW()")
        return cur.rowcount
