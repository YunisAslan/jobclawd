"""
AI Decision Gate — determines which jobs need AI enrichment.

Rules:
  1. NEVER send to AI if all core fields have confidence ≥ 0.80
  2. ONLY send core fields that are below threshold
  3. Limit AI batch to top-N jobs by relevance (match_score)
  4. Skip jobs where fingerprint already has AI-enriched data
  5. Preprocess: truncate text, extract only relevant sections

This is the critical cost-control layer.
"""

from __future__ import annotations

from typing import Optional

from services.extraction.confidence import (
    ExtractionReport,
    CONFIDENCE_THRESHOLD_AI,
)
from utils.job_meta_extractor import primary_experience_value


# Max jobs to send to AI per search batch
AI_BATCH_LIMIT = 20

# Min fields that must need AI to justify an API call
MIN_FIELDS_FOR_AI = 1


def should_enrich_with_ai(report: ExtractionReport) -> bool:
    """Does this job need AI enrichment?"""
    needing = report.fields_needing_ai
    return len(needing) >= MIN_FIELDS_FOR_AI


def select_jobs_for_ai(
    jobs_with_reports: list[tuple[dict, ExtractionReport]],
    *,
    limit: int = AI_BATCH_LIMIT,
) -> list[tuple[dict, ExtractionReport, list[str]]]:
    """
    Select which jobs to send to AI, and which fields to extract.

    Returns list of (job_dict, report, fields_to_extract).
    Sorted by: most missing fields first, then by match_score descending.
    """
    candidates: list[tuple[dict, ExtractionReport, list[str]]] = []

    for job, report in jobs_with_reports:
        fields = report.fields_needing_ai
        if not fields:
            continue
        candidates.append((job, report, fields))

    # Sort: more missing fields first, then higher-scoring jobs
    candidates.sort(key=lambda x: (-len(x[2]), -(x[0].get("match_score", 0))))

    return candidates[:limit]


def build_ai_input(
    job: dict,
    fields_to_extract: list[str],
    *,
    max_text_len: int = 3000,
) -> Optional[dict]:
    """
    Build the input dict for AI extraction, including only relevant text
    and specifying which fields to extract.
    """
    title = job.get("title", "")
    text = job.get("description_snippet", "") or ""

    # If we have detailed text from enrichment
    detail = job.get("_detail_text", "")
    if detail:
        text = detail

    if not title and not text:
        return None

    # Compact text within token budget
    if len(text) > max_text_len:
        head = max_text_len * 2 // 3
        tail = max_text_len - head - 5
        text = f"{text[:head].strip()} ... {text[-tail:].strip()}"

    return {
        "id": job.get("url", ""),
        "title": title,
        "company": job.get("company", ""),
        "location_str": job.get("location_str", ""),
        "snippet": text,
        "detail_text": "",
        "extract_fields": fields_to_extract,
        "structured_hints": {
            "work_mode": job.get("work_mode_str"),
            "job_type": job.get("job_type_str"),
            "seniority": job.get("seniority_str"),
            "experience_years": job.get("experience_years_str"),
            "experience": primary_experience_value(
                job.get("seniority_str"),
                job.get("experience_years_str"),
            ) or job.get("experience_str"),
            "salary": job.get("salary_str"),
        },
        "card_badges": ((job.get("_card_data") or {}).get("card_badges") or []),
        "topline_labels": ((job.get("_card_data") or {}).get("topline_labels") or []),
    }


def merge_ai_results(
    report: ExtractionReport,
    ai_result: dict,
) -> ExtractionReport:
    """
    Merge AI-extracted fields into an existing ExtractionReport.
    AI results only overwrite fields with lower confidence.
    """
    from services.extraction.confidence import FieldResult

    field_map = {
        "work_mode": ("work_mode_str", "work_mode"),
        "job_type": ("job_type_str", "job_type"),
        "seniority": ("seniority_str", "seniority"),
        "experience_years": ("experience_years_str", "experience_years"),
        "salary": ("salary_str", "salary"),
    }

    for report_attr, (ai_key, _) in field_map.items():
        ai_value = ai_result.get(ai_key)
        if not ai_value:
            continue

        current: FieldResult = getattr(report, report_attr)
        ai_field = FieldResult(
            value=ai_value,
            confidence=0.85,
            method="ai",
            evidence="OpenAI extraction",
        )

        # Only replace if AI is more confident
        merged = current.merge(ai_field)
        setattr(report, report_attr, merged)

    return report
