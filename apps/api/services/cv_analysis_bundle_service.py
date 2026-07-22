"""Bundled CV analysis — scores the CV against the job (analysis only).

Suggestions are generated separately on-demand via /cv-suggestions.
"""

from services.cv_analysis_shared import prepare_cv_analysis_inputs
from services.cv_document_service import infer_cv_filename
from services.cv_match_service import compute_cv_match_from_data


async def analyze_cv_bundle(job_url: str, cv_url: str, api_key: str, email: str = "", cv_name: str = "") -> dict:
    cv_name = cv_name.strip() or infer_cv_filename(cv_url)

    # ── Cache lookup ──────────────────────────────────────────────────────────
    if email:
        try:
            from repositories.cv_analysis_cache_repo import get_cv_analysis
            cached = get_cv_analysis(email, cv_url, job_url)
            if cached:
                analysis = cached["analysis"]
                return {
                    "analysis": analysis,
                    "suggestions": _empty_suggestions(),
                    "draft": {
                        "text": "",
                        "file_name": cached["cv_name"] or cv_name,
                    },
                    "job_title": analysis.pop("_job_title", ""),
                    "job_company": analysis.pop("_job_company", ""),
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
            "suggestions": _empty_suggestions(),
            "draft": {"text": "", "file_name": cv_name},
            "job_title": "",
            "job_company": "",
            "error_analysis": reason,
            "error_suggestions": None,
            "error_draft": reason,
        }

    analysis = await compute_cv_match_from_data(job_context, cv_text, api_key, deterministic=True)

    job_title = job_context.get("title", "")
    job_company = job_context.get("company", "")

    # ── Cache write (embed job metadata so cache hits can return it) ─────────
    if email and analysis.get("categories"):
        try:
            from repositories.cv_analysis_cache_repo import set_cv_analysis
            analysis_to_cache = {**analysis, "_job_title": job_title, "_job_company": job_company}
            set_cv_analysis(email, cv_url, job_url, analysis_to_cache, _empty_suggestions(), cv_name)
        except Exception:
            pass  # Non-fatal

    return {
        "analysis": analysis,
        "suggestions": _empty_suggestions(),
        "draft": {
            "text": cv_text,
            "file_name": cv_name,
        },
        "job_title": job_title,
        "job_company": job_company,
        "error_analysis": analysis["summary"] if not analysis.get("categories") else None,
        "error_suggestions": None,
        "error_draft": None,
    }


def _empty_analysis(reason: str) -> dict:
    return {
        "overall_score": 0,
        "match_level": "trash",
        "categories": [],
        "summary": reason,
    }


def _empty_suggestions() -> dict:
    return {"suggestions": [], "total": 0, "job_title": "", "job_company": ""}
