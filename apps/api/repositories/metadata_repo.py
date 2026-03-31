"""
Repository: read/write job metadata cache in PostgreSQL.
Keyed by job URL — stores extracted metadata from the Vacancy Intelligence Engine.

Fields: experience, salary, job_type, work_mode, skills,
        languages, parse_confidence, fingerprint, parser_version.
"""

from typing import Optional
from db.database import get_db
from utils.job_meta_extractor import primary_experience_value, split_experience_value

METADATA_TTL_HOURS = 24

# All metadata columns (excluding url, created_at, expires_at)
_META_COLUMNS = (
    "seniority_str", "seniority_src",
    "experience_years_str", "experience_years_src",
    "experience_str", "experience_src",
    "job_type_str", "job_type_src",
    "salary_str", "salary_src",
    "work_mode_str", "work_mode_src",
    "skills_str", "languages_str",
    "parse_confidence", "parser_version",
    "fingerprint",
)

_SELECT_COLUMNS = ", ".join(_META_COLUMNS)


def _sanitize_metadata_row(row_dict: dict) -> dict:
    """Remove None values and drop low-trust regex-only fields (except salary)."""
    cleaned = {k: v for k, v in row_dict.items() if v is not None}
    for value_field, source_field in (
        ("seniority_str", "seniority_src"),
        ("experience_years_str", "experience_years_src"),
        ("experience_str", "experience_src"),
        ("job_type_str", "job_type_src"),
        ("work_mode_str", "work_mode_src"),
    ):
        if cleaned.get(source_field) == "regex":
            cleaned.pop(value_field, None)
            cleaned.pop(source_field, None)
    if not cleaned.get("seniority_str") and not cleaned.get("experience_years_str") and cleaned.get("experience_str"):
        seniority, years = split_experience_value(cleaned["experience_str"])
        if seniority:
            cleaned["seniority_str"] = seniority
            cleaned["seniority_src"] = cleaned.get("experience_src")
        if years:
            cleaned["experience_years_str"] = years
            cleaned["experience_years_src"] = cleaned.get("experience_src")
    primary_experience = primary_experience_value(
        cleaned.get("seniority_str"),
        cleaned.get("experience_years_str"),
    )
    if primary_experience:
        cleaned["experience_str"] = primary_experience
        cleaned["experience_src"] = (
            cleaned.get("seniority_src")
            if cleaned.get("seniority_str")
            else cleaned.get("experience_years_src")
        )
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
    seniority_str: Optional[str] = None,
    seniority_src: Optional[str] = None,
    experience_years_str: Optional[str] = None,
    experience_years_src: Optional[str] = None,
    experience_str: Optional[str] = None,
    experience_src: Optional[str] = None,
    job_type_str: Optional[str] = None,
    job_type_src: Optional[str] = None,
    salary_str: Optional[str] = None,
    salary_src: Optional[str] = None,
    work_mode_str: Optional[str] = None,
    work_mode_src: Optional[str] = None,
    skills_str: Optional[str] = None,
    languages_str: Optional[str] = None,
    parse_confidence: Optional[int] = None,
    parser_version: Optional[str] = None,
    fingerprint: Optional[str] = None,
) -> None:
    """Insert or update metadata for a job URL."""
    # Drop low-trust regex-only fields (except salary)
    if seniority_src == "regex":
        seniority_str = None
        seniority_src = None
    if experience_years_src == "regex":
        experience_years_str = None
        experience_years_src = None
    if experience_src == "regex":
        experience_str = None
        experience_src = None
    if job_type_src == "regex":
        job_type_str = None
        job_type_src = None
    if work_mode_src == "regex":
        work_mode_str = None
        work_mode_src = None

    if not seniority_str and not experience_years_str and experience_str:
        seniority_str, experience_years_str = split_experience_value(experience_str)
        if seniority_str and not seniority_src:
            seniority_src = experience_src
        if experience_years_str and not experience_years_src:
            experience_years_src = experience_src

    experience_str = primary_experience_value(seniority_str, experience_years_str) or experience_str
    if experience_str and not experience_src:
        experience_src = seniority_src if seniority_str else experience_years_src

    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO job_metadata (
                url, seniority_str, seniority_src, experience_years_str, experience_years_src,
                experience_str, experience_src, job_type_str, job_type_src,
                salary_str, salary_src, work_mode_str, work_mode_src,
                skills_str, languages_str,
                parse_confidence, parser_version, fingerprint,
                expires_at
            )
            VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                NOW() + (%s || ' hours')::interval
            )
            ON CONFLICT (url) DO UPDATE SET
                seniority_str      = COALESCE(EXCLUDED.seniority_str,      job_metadata.seniority_str),
                seniority_src      = COALESCE(EXCLUDED.seniority_src,      job_metadata.seniority_src),
                experience_years_str = COALESCE(EXCLUDED.experience_years_str, job_metadata.experience_years_str),
                experience_years_src = COALESCE(EXCLUDED.experience_years_src, job_metadata.experience_years_src),
                experience_str     = COALESCE(EXCLUDED.experience_str,     job_metadata.experience_str),
                experience_src     = COALESCE(EXCLUDED.experience_src,     job_metadata.experience_src),
                job_type_str       = COALESCE(EXCLUDED.job_type_str,       job_metadata.job_type_str),
                job_type_src       = COALESCE(EXCLUDED.job_type_src,       job_metadata.job_type_src),
                salary_str         = COALESCE(EXCLUDED.salary_str,         job_metadata.salary_str),
                salary_src         = COALESCE(EXCLUDED.salary_src,         job_metadata.salary_src),
                work_mode_str      = COALESCE(EXCLUDED.work_mode_str,      job_metadata.work_mode_str),
                work_mode_src      = COALESCE(EXCLUDED.work_mode_src,      job_metadata.work_mode_src),
                skills_str         = COALESCE(EXCLUDED.skills_str,         job_metadata.skills_str),
                languages_str      = COALESCE(EXCLUDED.languages_str,      job_metadata.languages_str),
                parse_confidence   = COALESCE(EXCLUDED.parse_confidence,   job_metadata.parse_confidence),
                parser_version     = COALESCE(EXCLUDED.parser_version,     job_metadata.parser_version),
                fingerprint        = COALESCE(EXCLUDED.fingerprint,        job_metadata.fingerprint),
                expires_at         = EXCLUDED.expires_at
            """,
            (
                url,
                seniority_str, seniority_src,
                experience_years_str, experience_years_src,
                experience_str, experience_src,
                job_type_str, job_type_src,
                salary_str, salary_src,
                work_mode_str, work_mode_src,
                skills_str, languages_str,
                parse_confidence, parser_version, fingerprint,
                METADATA_TTL_HOURS,
            ),
        )


def delete_expired_metadata() -> int:
    """Delete expired normalized job metadata rows."""
    with get_db() as conn:
        cur = conn.execute("DELETE FROM job_metadata WHERE expires_at <= NOW()")
        return cur.rowcount or 0
