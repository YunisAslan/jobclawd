"""
Repository: read/write job metadata cache in PostgreSQL.
Keyed by job URL — stores extracted metadata from the Vacancy Intelligence Engine.

Fields: experience, salary, job_type, work_mode, apply_method, skills,
        languages, work_auth, parse_confidence, fingerprint, parser_version.
"""

from typing import Optional
from db.database import get_db

METADATA_TTL_HOURS = 24

# All metadata columns (excluding url, created_at, expires_at)
_META_COLUMNS = (
    "experience_str", "experience_src",
    "job_type_str", "job_type_src",
    "salary_str", "salary_src",
    "work_mode_str", "work_mode_src",
    "apply_method_str", "apply_method_src",
    "skills_str", "languages_str", "work_auth_str",
    "parse_confidence", "parser_version",
    "fingerprint", "apply_complexity", "auto_apply_support",
)

_SELECT_COLUMNS = ", ".join(_META_COLUMNS)


def _sanitize_metadata_row(row_dict: dict) -> dict:
    """Remove None values and drop low-trust regex-only fields (except salary)."""
    cleaned = {k: v for k, v in row_dict.items() if v is not None}
    for value_field, source_field in (
        ("experience_str", "experience_src"),
        ("job_type_str", "job_type_src"),
        ("work_mode_str", "work_mode_src"),
    ):
        if cleaned.get(source_field) == "regex":
            cleaned.pop(value_field, None)
            cleaned.pop(source_field, None)
    return cleaned


def get_metadata(url: str) -> Optional[dict]:
    """Return cached metadata dict for a job URL, or None."""
    with get_db() as conn:
        row = conn.execute(
            f"SELECT {_SELECT_COLUMNS} "
            "FROM job_metadata WHERE url = %s AND expires_at > NOW()",
            (url,),
        ).fetchone()
    if row is None:
        return None
    cleaned = _sanitize_metadata_row(dict(row))
    return cleaned or None


def get_metadata_batch(urls: list[str]) -> dict[str, dict]:
    """Return metadata for multiple URLs at once. Returns {url: {field: value}}."""
    if not urls:
        return {}
    with get_db() as conn:
        rows = conn.execute(
            f"SELECT url, {_SELECT_COLUMNS} "
            "FROM job_metadata WHERE url = ANY(%s) AND expires_at > NOW()",
            (urls,),
        ).fetchall()
    result = {}
    for row in rows:
        d = dict(row)
        url = d.pop("url")
        cleaned = _sanitize_metadata_row(d)
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
    apply_method_str: Optional[str] = None,
    apply_method_src: Optional[str] = None,
    skills_str: Optional[str] = None,
    languages_str: Optional[str] = None,
    work_auth_str: Optional[str] = None,
    parse_confidence: Optional[int] = None,
    parser_version: Optional[str] = None,
    fingerprint: Optional[str] = None,
    apply_complexity: Optional[str] = None,
    auto_apply_support: Optional[str] = None,
) -> None:
    """Insert or update metadata for a job URL."""
    # Drop low-trust regex-only fields (except salary)
    if experience_src == "regex":
        experience_str = None
        experience_src = None
    if job_type_src == "regex":
        job_type_str = None
        job_type_src = None
    if work_mode_src == "regex":
        work_mode_str = None
        work_mode_src = None

    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO job_metadata (
                url, experience_str, experience_src, job_type_str, job_type_src,
                salary_str, salary_src, work_mode_str, work_mode_src,
                apply_method_str, apply_method_src,
                skills_str, languages_str, work_auth_str,
                parse_confidence, parser_version, fingerprint,
                apply_complexity, auto_apply_support,
                expires_at
            )
            VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                NOW() + (%s || ' hours')::interval
            )
            ON CONFLICT (url) DO UPDATE SET
                experience_str     = COALESCE(EXCLUDED.experience_str,     job_metadata.experience_str),
                experience_src     = COALESCE(EXCLUDED.experience_src,     job_metadata.experience_src),
                job_type_str       = COALESCE(EXCLUDED.job_type_str,       job_metadata.job_type_str),
                job_type_src       = COALESCE(EXCLUDED.job_type_src,       job_metadata.job_type_src),
                salary_str         = COALESCE(EXCLUDED.salary_str,         job_metadata.salary_str),
                salary_src         = COALESCE(EXCLUDED.salary_src,         job_metadata.salary_src),
                work_mode_str      = COALESCE(EXCLUDED.work_mode_str,      job_metadata.work_mode_str),
                work_mode_src      = COALESCE(EXCLUDED.work_mode_src,      job_metadata.work_mode_src),
                apply_method_str   = COALESCE(EXCLUDED.apply_method_str,   job_metadata.apply_method_str),
                apply_method_src   = COALESCE(EXCLUDED.apply_method_src,   job_metadata.apply_method_src),
                skills_str         = COALESCE(EXCLUDED.skills_str,         job_metadata.skills_str),
                languages_str      = COALESCE(EXCLUDED.languages_str,      job_metadata.languages_str),
                work_auth_str      = COALESCE(EXCLUDED.work_auth_str,      job_metadata.work_auth_str),
                parse_confidence   = COALESCE(EXCLUDED.parse_confidence,   job_metadata.parse_confidence),
                parser_version     = COALESCE(EXCLUDED.parser_version,     job_metadata.parser_version),
                fingerprint        = COALESCE(EXCLUDED.fingerprint,        job_metadata.fingerprint),
                apply_complexity   = COALESCE(EXCLUDED.apply_complexity,   job_metadata.apply_complexity),
                auto_apply_support = COALESCE(EXCLUDED.auto_apply_support, job_metadata.auto_apply_support),
                expires_at         = EXCLUDED.expires_at
            """,
            (
                url,
                experience_str, experience_src,
                job_type_str, job_type_src,
                salary_str, salary_src,
                work_mode_str, work_mode_src,
                apply_method_str, apply_method_src,
                skills_str, languages_str, work_auth_str,
                parse_confidence, parser_version, fingerprint,
                apply_complexity, auto_apply_support,
                METADATA_TTL_HOURS,
            ),
        )


def delete_expired_metadata() -> int:
    """Delete expired normalized job metadata rows."""
    with get_db() as conn:
        cur = conn.execute("DELETE FROM job_metadata WHERE expires_at <= NOW()")
        return cur.rowcount or 0
