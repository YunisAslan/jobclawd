"""
Repository: read/write job metadata cache in PostgreSQL.
Keyed by job URL — stores extracted experience, salary, job_type, work_mode.
"""

from typing import Optional
from db.database import get_db

METADATA_TTL_HOURS = 24


def get_metadata(url: str) -> Optional[dict]:
    """Return cached metadata dict for a job URL, or None."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT experience_str, experience_src, job_type_str, job_type_src, "
            "salary_str, salary_src, work_mode_str, work_mode_src "
            "FROM job_metadata WHERE url = %s AND expires_at > NOW()",
            (url,),
        ).fetchone()
    if row is None:
        return None
    return {k: v for k, v in dict(row).items() if v is not None}


def get_metadata_batch(urls: list[str]) -> dict[str, dict]:
    """Return metadata for multiple URLs at once. Returns {url: {field: value}}."""
    if not urls:
        return {}
    with get_db() as conn:
        # Use ANY(%s) for batch lookup
        rows = conn.execute(
            "SELECT url, experience_str, experience_src, job_type_str, job_type_src, "
            "salary_str, salary_src, work_mode_str, work_mode_src "
            "FROM job_metadata WHERE url = ANY(%s) AND expires_at > NOW()",
            (urls,),
        ).fetchall()
    result = {}
    for row in rows:
        d = dict(row)
        url = d.pop("url")
        cleaned = {k: v for k, v in d.items() if v is not None}
        if cleaned:
            result[url] = cleaned
    return result


def upsert_metadata(
    url: str,
    experience_str: Optional[str] = None,
    experience_src: Optional[str] = None,
    job_type_str: Optional[str] = None,
    job_type_src: Optional[str] = None,
    salary_str: Optional[str] = None,
    salary_src: Optional[str] = None,
    work_mode_str: Optional[str] = None,
    work_mode_src: Optional[str] = None,
) -> None:
    """Insert or update metadata for a job URL."""
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO job_metadata (
                url, experience_str, experience_src, job_type_str, job_type_src,
                salary_str, salary_src, work_mode_str, work_mode_src, expires_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW() + (%s || ' hours')::interval)
            ON CONFLICT (url) DO UPDATE SET
                experience_str = COALESCE(EXCLUDED.experience_str, job_metadata.experience_str),
                experience_src = COALESCE(EXCLUDED.experience_src, job_metadata.experience_src),
                job_type_str   = COALESCE(EXCLUDED.job_type_str,   job_metadata.job_type_str),
                job_type_src   = COALESCE(EXCLUDED.job_type_src,   job_metadata.job_type_src),
                salary_str     = COALESCE(EXCLUDED.salary_str,     job_metadata.salary_str),
                salary_src     = COALESCE(EXCLUDED.salary_src,     job_metadata.salary_src),
                work_mode_str  = COALESCE(EXCLUDED.work_mode_str,  job_metadata.work_mode_str),
                work_mode_src  = COALESCE(EXCLUDED.work_mode_src,  job_metadata.work_mode_src),
                expires_at     = EXCLUDED.expires_at
            """,
            (
                url,
                experience_str,
                experience_src,
                job_type_str,
                job_type_src,
                salary_str,
                salary_src,
                work_mode_str,
                work_mode_src,
                METADATA_TTL_HOURS,
            ),
        )


def delete_expired_metadata() -> int:
    """Delete expired normalized job metadata rows."""
    with get_db() as conn:
        cur = conn.execute("DELETE FROM job_metadata WHERE expires_at <= NOW()")
        return cur.rowcount or 0
