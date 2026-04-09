"""Bundled CV analysis — runs match + suggestions in parallel, with caching."""

import asyncio

from services.cv_analysis_shared import prepare_cv_analysis_inputs
from services.cv_document_service import infer_cv_filename
from services.cv_match_service import compute_cv_match_from_data
from services.cv_suggestions_service import generate_cv_suggestions_from_data


async def analyze_cv_bundle(job_url: str, cv_url: str, email: str = "") -> dict:
    cv_name = infer_cv_filename(cv_url)

    # ── Cache lookup ──────────────────────────────────────────────────────────
    if email:
        try:
            from repositories.cv_analysis_cache_repo import get_cv_analysis
            cached = get_cv_analysis(email, cv_url, job_url)
            if cached:
                return {
                    "analysis": cached["analysis"],
                    "suggestions": cached["suggestions"],
                    "draft": {
                        "text": "",
                        "file_name": cached["cv_name"] or cv_name,
                    },
                    "error_analysis": None,
                    "error_suggestions": None,
                    "error_draft": None,
                }
        except Exception:
            pass  # Cache miss or DB error — fall through to compute

    # ── Compute ───────────────────────────────────────────────────────────────
    cv_text, job_context, error = await prepare_cv_analysis_inputs(job_url, cv_url)

    if error or not cv_text or not job_context:
        reason = error or "Could not prepare CV analysis."
        return {
            "analysis": _empty_analysis(reason),
            "suggestions": _empty_suggestions(reason),
            "draft": {"text": "", "file_name": cv_name},
            "error_analysis": reason,
            "error_suggestions": reason,
            "error_draft": reason,
        }

    analysis, suggestions = await asyncio.gather(
        compute_cv_match_from_data(job_context, cv_text, deterministic=True),
        generate_cv_suggestions_from_data(job_context, cv_text),
    )

    # ── Cache write ───────────────────────────────────────────────────────────
    if email and analysis.get("categories"):
        try:
            from repositories.cv_analysis_cache_repo import set_cv_analysis
            set_cv_analysis(email, cv_url, job_url, analysis, suggestions, cv_name)
        except Exception:
            pass  # Non-fatal

    return {
        "analysis": analysis,
        "suggestions": suggestions,
        "draft": {
            "text": cv_text,
            "file_name": cv_name,
        },
        "error_analysis": analysis["summary"] if not analysis.get("categories") else None,
        "error_suggestions": None if suggestions.get("suggestions") else "No suggestions generated. The AI may be unavailable.",
        "error_draft": None,
    }


def _empty_analysis(reason: str) -> dict:
    return {
        "overall_score": 0,
        "match_level": "trash",
        "categories": [],
        "summary": reason,
    }


def _empty_suggestions(reason: str) -> dict:
    return {
        "suggestions": [],
        "total": 0,
        "job_title": "",
        "job_company": "",
    }
