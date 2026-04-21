"""
Repository: aggregate analytics queries for the analytics dashboard.
All queries are scoped to a single user_email.
"""
from db.database import get_db
from models.schemas import (
    AnalyticsResponse,
    CVAnalyticsEntry,
    ScoreDistributionEntry,
    TopJobTitleEntry,
    SourceBreakdownEntry,
    WeeklyChartEntry,
)


def _derive_source_label(job_url: str) -> str:
    u = (job_url or "").lower()
    if "linkedin" in u:
        return "LinkedIn"
    if "indeed" in u:
        return "Indeed"
    return "JobSearch.az"


def get_analytics(email: str) -> AnalyticsResponse:
    with get_db() as conn:

        # ── KPI: total analyses ────────────────────────────────────────────
        total_analyses = conn.execute(
            "SELECT COUNT(*) AS cnt FROM cv_analysis_events WHERE user_email = %s",
            (email,),
        ).fetchone()["cnt"]

        # ── KPI: average match score ───────────────────────────────────────
        avg_score_row = conn.execute(
            """
            SELECT COALESCE(ROUND(AVG(overall_score::numeric), 1), 0) AS avg
            FROM cv_analysis_events
            WHERE user_email = %s AND overall_score IS NOT NULL
            """,
            (email,),
        ).fetchone()
        avg_match_score = float(avg_score_row["avg"] if avg_score_row else 0)

        # ── KPI: distinct CVs used ─────────────────────────────────────────
        cvs_compared = conn.execute(
            """
            SELECT COUNT(DISTINCT cv_name) AS cnt
            FROM cv_analysis_events
            WHERE user_email = %s AND cv_name IS NOT NULL AND cv_name <> ''
            """,
            (email,),
        ).fetchone()["cnt"]

        # ── KPI: apply clicks (applications table has no user_email) ──────
        total_apply_clicks = conn.execute(
            "SELECT COUNT(*) AS cnt FROM applications",
        ).fetchone()["cnt"]

        # ── KPI: suggestions applied ───────────────────────────────────────
        total_suggestions = conn.execute(
            "SELECT COUNT(*) AS cnt FROM suggestion_events WHERE user_email = %s",
            (email,),
        ).fetchone()["cnt"]

        # ── KPI: saved vacancies (current) ────────────────────────────────
        total_saved = conn.execute(
            "SELECT COUNT(*) AS cnt FROM saved_vacancies WHERE user_email = %s",
            (email,),
        ).fetchone()["cnt"]

        # ── Check Impact stats ─────────────────────────────────────────────
        impact_rows = conn.execute(
            "SELECT score_before, score_after FROM impact_check_events WHERE user_email = %s",
            (email,),
        ).fetchall()
        total_impact_checks = len(impact_rows)
        deltas = [r["score_after"] - r["score_before"] for r in impact_rows]
        avg_score_delta = round(sum(deltas) / len(deltas), 1) if deltas else 0.0

        # ── CV performance ─────────────────────────────────────────────────
        cv_rows = conn.execute(
            """
            SELECT
                cv_name,
                COUNT(*) AS analyses,
                ROUND(AVG(overall_score::numeric), 1) AS avg_score,
                MAX(overall_score) AS best_score
            FROM cv_analysis_events
            WHERE user_email = %s
              AND cv_name IS NOT NULL AND cv_name <> ''
              AND overall_score IS NOT NULL
            GROUP BY cv_name
            ORDER BY analyses DESC
            LIMIT 10
            """,
            (email,),
        ).fetchall()

        # ── Score distribution ─────────────────────────────────────────────
        score_dist_rows = conn.execute(
            """
            SELECT
                CASE
                    WHEN overall_score >= 75 THEN 'Strong (75+)'
                    WHEN overall_score >= 50 THEN 'Good (50–74)'
                    ELSE                          'Low (<50)'
                END AS band,
                COUNT(*) AS cnt
            FROM cv_analysis_events
            WHERE user_email = %s AND overall_score IS NOT NULL
            GROUP BY 1
            ORDER BY MIN(
                CASE
                    WHEN overall_score >= 75 THEN 1
                    WHEN overall_score >= 50 THEN 2
                    ELSE                          3
                END
            )
            """,
            (email,),
        ).fetchall()

        # ── Top job titles ─────────────────────────────────────────────────
        title_rows = conn.execute(
            """
            SELECT job_title, COUNT(*) AS cnt
            FROM cv_analysis_events
            WHERE user_email = %s AND job_title IS NOT NULL AND job_title <> ''
            GROUP BY job_title
            ORDER BY cnt DESC
            LIMIT 8
            """,
            (email,),
        ).fetchall()

        # ── Source breakdown (derived from job_url) ───────────────────────
        source_rows = conn.execute(
            """
            SELECT
                CASE
                    WHEN job_url ILIKE '%%linkedin%%' THEN 'LinkedIn'
                    WHEN job_url ILIKE '%%indeed%%'   THEN 'Indeed'
                    ELSE                                   'JobSearch.az'
                END AS source,
                COUNT(*) AS cnt
            FROM cv_analysis_events
            WHERE user_email = %s AND job_url IS NOT NULL
            GROUP BY 1
            ORDER BY cnt DESC
            """,
            (email,),
        ).fetchall()

        # ── 30-day daily trend (analyses) ──────────────────────────────────
        trend_rows = conn.execute(
            """
            SELECT created_at::date AS d, COUNT(*) AS cnt
            FROM cv_analysis_events
            WHERE user_email = %s
              AND created_at >= CURRENT_DATE - INTERVAL '29 days'
            GROUP BY d
            ORDER BY d
            """,
            (email,),
        ).fetchall()

    # ── Analysis-to-apply ratio ────────────────────────────────────────────
    analysis_to_apply_ratio = (
        round((total_apply_clicks / total_analyses) * 100, 1)
        if total_analyses > 0
        else 0.0
    )

    return AnalyticsResponse(
        total_analyses=total_analyses,
        total_apply_clicks=total_apply_clicks,
        total_suggestions_applied=total_suggestions,
        total_saved=total_saved,
        avg_match_score=avg_match_score,
        cvs_compared=cvs_compared,
        total_impact_checks=total_impact_checks,
        avg_score_delta=avg_score_delta,
        cv_performance=[
            CVAnalyticsEntry(
                cv_name=r["cv_name"],
                analyses=r["analyses"],
                avg_score=float(r["avg_score"]),
                best_score=r["best_score"],
            )
            for r in cv_rows
        ],
        score_distribution=[
            ScoreDistributionEntry(band=r["band"], count=r["cnt"])
            for r in score_dist_rows
        ],
        top_job_titles=[
            TopJobTitleEntry(title=r["job_title"], count=r["cnt"])
            for r in title_rows
        ],
        source_breakdown=[
            SourceBreakdownEntry(source=r["source"], count=r["cnt"])
            for r in source_rows
        ],
        trend_30d=[
            WeeklyChartEntry(date=str(r["d"]), count=r["cnt"])
            for r in trend_rows
        ],
        analysis_to_apply_ratio=analysis_to_apply_ratio,
    )
