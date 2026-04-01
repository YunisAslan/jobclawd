"""Shared preparation for CV analysis flows."""

from typing import Optional

from repositories.metadata_repo import get_metadata
from scraper.detail import scrape_job_detail
from services.cv_extractor import extract_cv_text


async def prepare_cv_analysis_inputs(job_url: str, cv_url: str) -> tuple[Optional[str], Optional[dict], Optional[str]]:
    cv_text = extract_cv_text(cv_url)
    if not cv_text:
        return None, None, "Could not extract text from CV."

    job_context = await gather_job_context(job_url)
    if not job_context:
        return None, None, "Could not fetch job details."

    return cv_text, job_context, None


async def gather_job_context(job_url: str) -> Optional[dict]:
    """Build a context dict from metadata + one scraped detail fetch."""
    context: dict = {"url": job_url}

    meta = get_metadata(job_url)
    if meta:
        for key in (
            "seniority_str",
            "experience_years_str",
            "job_type_str",
            "salary_str",
            "work_mode_str",
            "skills_str",
            "languages_str",
        ):
            if meta.get(key):
                context[key] = meta[key]

    try:
        detail = await scrape_job_detail(job_url)
        context["title"] = detail.title
        context["company"] = detail.company
        if detail.description:
            context["description"] = detail.description[:3000]
    except Exception as exc:
        print(f"[CVAnalysis] Detail scrape failed for {job_url}: {exc}")
        if not meta:
            return None

    return context
