"""
Repository: insert analytics event rows (cv_analysis_events, suggestion_events, impact_check_events).
No business logic — pure data access.
"""
from db.database import get_db


def insert_cv_analysis_event(
    user_email: str,
    cv_url: str,
    cv_name: str,
    job_url: str,
    job_title: str,
    company: str,
    overall_score: int,
    match_level: str,
) -> None:
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO cv_analysis_events
              (user_email, cv_url, cv_name, job_url, job_title, company, overall_score, match_level)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (user_email, cv_url, cv_name, job_url, job_title, company, overall_score, match_level),
        )


def insert_suggestion_event(
    user_email: str,
    cv_name: str,
    job_url: str,
    category: str,
    priority: str,
) -> None:
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO suggestion_events (user_email, cv_name, job_url, category, priority)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (user_email, cv_name, job_url, category, priority),
        )


def insert_impact_check_event(
    user_email: str,
    cv_name: str,
    job_url: str,
    score_before: int,
    score_after: int,
) -> None:
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO impact_check_events (user_email, cv_name, job_url, score_before, score_after)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (user_email, cv_name, job_url, score_before, score_after),
        )
