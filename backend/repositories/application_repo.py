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
    """Insert a new application row. Returns new row id, or None on duplicate (UNIQUE job_url)."""
    with get_db() as conn:
        cursor = conn.execute(
            """
            INSERT OR IGNORE INTO applications
              (job_url, job_title, company, source, hr_email, cv_name, cv_url,
               match_score, match_level, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent')
            """,
            (job_url, job_title, company, source, hr_email,
             cv_name, cv_url, match_score, match_level),
        )
        return cursor.lastrowid or None


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
            "UPDATE applications SET status = ?, notes = ? WHERE id = ?",
            (status.value, notes, app_id),
        )
        row = conn.execute(
            "SELECT * FROM applications WHERE id = ?", (app_id,)
        ).fetchone()
    if not row:
        return None
    return ApplicationRecord(**dict(row))


def get_stats() -> StatsResponse:
    with get_db() as conn:
        today_row = conn.execute(
            "SELECT COUNT(*) as cnt FROM applications WHERE date(sent_at) = date('now')"
        ).fetchone()

        total_row = conn.execute(
            "SELECT COUNT(*) as cnt FROM applications"
        ).fetchone()

        replies_row = conn.execute(
            "SELECT COUNT(*) as cnt FROM applications WHERE status = 'replied'"
        ).fetchone()

        weekly_rows = conn.execute(
            """
            SELECT date(sent_at) as d, COUNT(*) as cnt
            FROM applications
            WHERE sent_at >= date('now', '-6 days')
            GROUP BY d
            ORDER BY d
            """
        ).fetchall()

        cv_rows = conn.execute(
            """
            SELECT
              COALESCE(cv_name, 'Naməlum') as cv_name,
              COUNT(*) as sent,
              SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) as replies
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
        weekly_chart=[WeeklyChartEntry(date=r["d"], count=r["cnt"]) for r in weekly_rows],
        cv_performance=[
            CVPerformanceEntry(cv_name=r["cv_name"], sent=r["sent"], replies=r["replies"])
            for r in cv_rows
        ],
    )
