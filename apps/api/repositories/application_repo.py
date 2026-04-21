"""
Repository: all SQL operations for the applications table and stats queries.
No business logic — pure data access.
"""
from typing import Optional

from db.database import get_db
from models.schemas import (
    ApplicationRecord,
    ApplicationStatus,
    StatsResponse,
    WeeklyChartEntry,
    CVPerformanceEntry,
)


def insert_application(
    job_url: str,
    job_title: str,
    company: str,
    source: str,
    hr_email: Optional[str],
    cv_name: Optional[str],
    cv_url: Optional[str],
    match_score: Optional[int],
    match_level: Optional[str],
) -> Optional[int]:
    """Insert a new application row. Returns the new row id, or None on duplicate (UNIQUE job_url)."""
    with get_db() as conn:
        row = conn.execute(
            """
            INSERT INTO applications
              (job_url, job_title, company, source, hr_email, cv_name, cv_url,
               match_score, match_level, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'sent')
            ON CONFLICT (job_url) DO NOTHING
            RETURNING id
            """,
            (job_url, job_title, company, source, hr_email,
             cv_name, cv_url, match_score, match_level),
        ).fetchone()
    return row["id"] if row else None


def get_all_applications() -> list[ApplicationRecord]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM applications ORDER BY sent_at DESC"
        ).fetchall()
    return [ApplicationRecord(**dict(r)) for r in rows]


def update_application(
    app_id: int,
    status: ApplicationStatus,
    notes: Optional[str],
) -> Optional[ApplicationRecord]:
    with get_db() as conn:
        conn.execute(
            "UPDATE applications SET status = %s, notes = %s WHERE id = %s",
            (status.value, notes, app_id),
        )
        row = conn.execute(
            "SELECT * FROM applications WHERE id = %s", (app_id,)
        ).fetchone()
    if not row:
        return None
    return ApplicationRecord(**dict(row))


def get_stats() -> StatsResponse:
    with get_db() as conn:
        today_row = conn.execute(
            "SELECT COUNT(*) AS cnt FROM applications WHERE sent_at::date = CURRENT_DATE"
        ).fetchone()

        total_row = conn.execute(
            "SELECT COUNT(*) AS cnt FROM applications"
        ).fetchone()

        replies_row = conn.execute(
            "SELECT COUNT(*) AS cnt FROM applications WHERE status = 'replied'"
        ).fetchone()

        weekly_rows = conn.execute(
            """
            SELECT sent_at::date AS d, COUNT(*) AS cnt
            FROM applications
            WHERE sent_at >= CURRENT_DATE - INTERVAL '6 days'
            GROUP BY sent_at::date
            ORDER BY sent_at::date
            """
        ).fetchall()

        cv_rows = conn.execute(
            """
            SELECT
              COALESCE(cv_name, 'Unknown') AS cv_name,
              COUNT(*) AS sent,
              SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) AS replies
            FROM applications
            WHERE cv_name IS NOT NULL
            GROUP BY cv_name
            ORDER BY sent DESC
            LIMIT 10
            """
        ).fetchall()

    return StatsResponse(
        today_count=today_row["cnt"] if today_row else 0,
        total_sent=total_row["cnt"] if total_row else 0,
        total_replies=replies_row["cnt"] if replies_row else 0,
        weekly_chart=[WeeklyChartEntry(date=str(r["d"]), count=r["cnt"]) for r in weekly_rows],
        cv_performance=[
            CVPerformanceEntry(cv_name=r["cv_name"], sent=r["sent"], replies=r["replies"])
            for r in cv_rows
        ],
    )


