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
    AnalyticsResponse,
    FunnelEntry,
    MatchBandEntry,
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


def get_analytics() -> AnalyticsResponse:
    with get_db() as conn:
        # ── Funnel counts ──────────────────────────────────────────────────
        total_row = conn.execute("SELECT COUNT(*) AS cnt FROM applications").fetchone()
        replied_row = conn.execute(
            "SELECT COUNT(*) AS cnt FROM applications WHERE status = 'replied'"
        ).fetchone()
        rejected_row = conn.execute(
            "SELECT COUNT(*) AS cnt FROM applications WHERE status = 'rejected'"
        ).fetchone()
        active_row = conn.execute(
            "SELECT COUNT(*) AS cnt FROM applications WHERE status IN ('sent','waiting_input','open_manually')"
        ).fetchone()

        # ── CV performance ─────────────────────────────────────────────────
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

        # ── Match-score band impact ────────────────────────────────────────
        band_rows = conn.execute(
            """
            SELECT
              CASE
                WHEN match_score IS NULL       THEN 'Unscored'
                WHEN match_score >= 75         THEN 'Strong (75+)'
                WHEN match_score >= 50         THEN 'Good (50–74)'
                ELSE                                'Low (<50)'
              END AS band,
              COUNT(*) AS applied,
              SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) AS replied
            FROM applications
            GROUP BY 1
            ORDER BY
              MIN(CASE
                WHEN match_score IS NULL       THEN 4
                WHEN match_score >= 75         THEN 1
                WHEN match_score >= 50         THEN 2
                ELSE                                3
              END)
            """
        ).fetchall()

        # ── 30-day daily trend ────────────────────────────────────────────
        trend_rows = conn.execute(
            """
            SELECT sent_at::date AS d, COUNT(*) AS cnt
            FROM applications
            WHERE sent_at >= CURRENT_DATE - INTERVAL '29 days'
            GROUP BY sent_at::date
            ORDER BY sent_at::date
            """
        ).fetchall()

    total = total_row["cnt"] if total_row else 0
    replies = replied_row["cnt"] if replied_row else 0
    rejected = rejected_row["cnt"] if rejected_row else 0
    active = active_row["cnt"] if active_row else 0

    reply_rate = round((replies / total) * 100, 1) if total > 0 else 0.0

    # Build funnel
    got_response = replies + rejected
    funnel = [
        FunnelEntry(label="Applied", count=total, pct=100.0),
        FunnelEntry(label="Active", count=active, pct=round((active / total) * 100, 1) if total else 0.0),
        FunnelEntry(label="Got Response", count=got_response, pct=round((got_response / total) * 100, 1) if total else 0.0),
        FunnelEntry(label="Interview / Replied", count=replies, pct=round((replies / total) * 100, 1) if total else 0.0),
    ]

    # CV performance + best CV
    cv_perf = [
        CVPerformanceEntry(cv_name=r["cv_name"], sent=r["sent"], replies=r["replies"])
        for r in cv_rows
    ]
    best_cv_name: Optional[str] = None
    best_cv_reply_rate: Optional[float] = None
    for cv in cv_perf:
        if cv.sent >= 3:  # minimum sample size
            rate = round((cv.replies / cv.sent) * 100, 1)
            if best_cv_reply_rate is None or rate > best_cv_reply_rate:
                best_cv_reply_rate = rate
                best_cv_name = cv.cv_name

    # Match bands
    bands = [
        MatchBandEntry(
            band=r["band"],
            applied=r["applied"],
            replied=r["replied"],
            reply_rate=round((r["replied"] / r["applied"]) * 100, 1) if r["applied"] > 0 else 0.0,
        )
        for r in band_rows
    ]

    # 30-day trend
    trend = [WeeklyChartEntry(date=str(r["d"]), count=r["cnt"]) for r in trend_rows]

    return AnalyticsResponse(
        total_applied=total,
        total_replies=replies,
        reply_rate=reply_rate,
        best_cv_name=best_cv_name,
        best_cv_reply_rate=best_cv_reply_rate,
        funnel=funnel,
        cv_performance=cv_perf,
        match_bands=bands,
        trend_30d=trend,
    )
