"""
Vacancy Intelligence Pipeline — the main orchestrator.

Flow:
  1. Deduplicate jobs (fingerprint-based)
  2. Check DB cache for existing extraction results
  3. Run deterministic extraction on all jobs
  4. Check confidence → decide which jobs need AI
  5. Batch AI extraction (only for jobs that need it)
  6. Merge results, persist to DB
  7. Return enriched jobs with confidence scores

This module is called by search_service after scraping is complete.
"""

from __future__ import annotations

import json
from typing import Optional

from services.extraction.confidence import ExtractionReport, FieldResult
from services.extraction.deterministic import extract_deterministic, classify_apply_complexity
from services.extraction.deduplication import (
    deduplicate_jobs,
    compute_fingerprint,
    get_cached_fingerprints,
    store_fingerprint,
)
from services.extraction.ai_decision import (
    should_enrich_with_ai,
    select_jobs_for_ai,
    build_ai_input,
    merge_ai_results,
)
from repositories.metadata_repo import get_metadata_batch, upsert_metadata
from services.ai_metadata_extractor import extract_metadata_ai_batch, ai_metadata_enabled
from utils.job_meta_extractor import primary_experience_value, split_experience_value

# Parser version — bump when extraction logic changes significantly
PARSER_VERSION = "2.0.0"


async def process_jobs(
    jobs: list[dict],
    *,
    progress_cb=None,
    skip_ai: bool = False,
) -> list[dict]:
    """
    Main pipeline entry point. Takes raw job dicts from scrapers,
    returns enriched dicts with all metadata fields populated.

    Steps:
      1. Deduplicate
      2. Load cached metadata
      3. Deterministic extraction
      4. AI enrichment (selective)
      5. Persist and return
    """
    if not jobs:
        return []

    # ── Step 1: Deduplicate ──────────────────────────────────────────
    jobs = deduplicate_jobs(jobs)

    # ── Step 2: Compute fingerprints and check DB cache ──────────────
    for job in jobs:
        if not job.get("_fingerprint"):
            job["_fingerprint"] = compute_fingerprint(
                title=job.get("title", ""),
                company=job.get("company", ""),
                location=job.get("location_str"),
            )

    # Load any existing metadata from DB
    urls = [j["url"] for j in jobs if j.get("url")]
    cached_meta = get_metadata_batch(urls) if urls else {}

    # Also check fingerprint cache for cross-platform hits
    fingerprints = list(set(j.get("_fingerprint", "") for j in jobs if j.get("_fingerprint")))
    fp_cache = {}
    try:
        fp_cache = get_cached_fingerprints(fingerprints)
    except Exception:
        pass  # fingerprint column may not exist yet

    # ── Step 3: Deterministic extraction ─────────────────────────────
    reports: dict[str, ExtractionReport] = {}  # url → report

    for job in jobs:
        url = job.get("url", "")

        # Build structured fields from what the scraper already provided
        structured = _build_structured_fields(job)

        # Run deterministic extraction
        report = extract_deterministic(
            title=job.get("title", ""),
            company=job.get("company", ""),
            description=job.get("description_snippet", ""),
            url=url,
            source=job.get("source", "jobsearch"),
            location_str=job.get("location_str"),
            hr_email=job.get("hr_email"),
            apply_url=job.get("_apply_url"),
            card_data=job.get("_card_data"),
            structured_fields=structured,
        )

        # Merge with cached metadata (DB)
        if url in cached_meta:
            cached_report = ExtractionReport.from_flat_dict(cached_meta[url])
            report = report.merge(cached_report)

        # Merge with fingerprint cache (cross-platform)
        fp = job.get("_fingerprint", "")
        if fp in fp_cache:
            fp_report = ExtractionReport.from_flat_dict(fp_cache[fp])
            report = report.merge(fp_report)

        reports[url] = report

    # ── Step 4: Selective AI enrichment ──────────────────────────────
    if not skip_ai and ai_metadata_enabled():
        jobs_needing_ai = [
            (job, reports[job.get("url", "")])
            for job in jobs
            if should_enrich_with_ai(reports.get(job.get("url", ""), ExtractionReport()))
        ]

        if jobs_needing_ai:
            selected = select_jobs_for_ai(jobs_needing_ai)

            if selected:
                ai_inputs = []
                url_to_fields: dict[str, list[str]] = {}

                for job, report, fields in selected:
                    ai_input = build_ai_input(job, fields)
                    if ai_input:
                        ai_inputs.append(ai_input)
                        url_to_fields[job.get("url", "")] = fields

                if ai_inputs:
                    if progress_cb:
                        await progress_cb("analyzing", f"AI enriching {len(ai_inputs)} jobs...", 0, 0)

                    try:
                        ai_results = await extract_metadata_ai_batch(
                            ai_inputs,
                            source="pipeline",
                            context="vacancy-intelligence",
                            progress_cb=None,
                        )

                        for url, ai_meta in ai_results.items():
                            if not ai_meta or url not in reports:
                                continue
                            # Add apply_method from AI if available
                            if ai_meta.get("apply_method"):
                                ai_meta["apply_method_str"] = ai_meta.pop("apply_method")
                            reports[url] = merge_ai_results(reports[url], ai_meta)

                    except Exception as e:
                        print(f"[Pipeline] AI enrichment error (non-fatal): {e}")

    # ── Step 5: Apply results back to jobs and persist ───────────────
    for job in jobs:
        url = job.get("url", "")
        report = reports.get(url)
        if not report:
            continue

        # Convert report to flat dict and merge into job
        flat = report.to_flat_dict()
        _apply_report_to_job(job, flat)

        # Persist to DB (fire-and-forget style, errors are non-fatal)
        try:
            persist_kwargs = _build_persist_kwargs(flat)
            if persist_kwargs:
                persist_kwargs["parser_version"] = PARSER_VERSION
                if job.get("_fingerprint"):
                    persist_kwargs["fingerprint"] = job["_fingerprint"]
                upsert_metadata(url, **persist_kwargs)
        except Exception as e:
            print(f"[Pipeline] Persist error for {url}: {e}")

        # Store fingerprint association
        fp = job.get("_fingerprint")
        if fp:
            try:
                store_fingerprint(url, fp)
            except Exception:
                pass  # fingerprint column may not exist yet

    # ── Step 6: Clean up internal fields ─────────────────────────────
    for job in jobs:
        job.pop("_fingerprint", None)
        job.pop("_detail_text", None)
        job.pop("_apply_url", None)
        job.pop("_card_data", None)

    return jobs


def _apply_report_to_job(job: dict, flat: dict) -> None:
    """Merge extraction report flat dict into a job dict."""
    # Core metadata fields — only replace if better
    field_pairs = [
        ("work_mode_str", "work_mode_src", "work_mode_conf"),
        ("job_type_str", "job_type_src", "job_type_conf"),
        ("seniority_str", "seniority_src", "seniority_conf"),
        ("experience_years_str", "experience_years_src", "experience_years_conf"),
        ("experience_str", "experience_src", "experience_conf"),
        ("salary_str", "salary_src", "salary_conf"),
        ("apply_method", "apply_method_src", "apply_method_conf"),
    ]
    # For apply_method, the flat dict uses "apply_method_str" but the job uses "apply_method"
    apply_val = flat.get("apply_method_str")
    if apply_val:
        flat["apply_method"] = apply_val

    for val_field, src_field, conf_field in field_pairs:
        incoming_val = flat.get(val_field)
        incoming_src = flat.get(src_field)
        incoming_conf = flat.get(conf_field, 0)
        current_val = job.get(val_field)
        current_src = (job.get(src_field) or "").strip().lower()

        # Replace if: no current value, or incoming is higher confidence (non-default)
        should_replace = not current_val
        if incoming_val and current_val:
            if current_src in ("default", "none", ""):
                should_replace = True
            elif current_src == "regex" and incoming_src in ("structured", "ai", "rule"):
                should_replace = True

        if incoming_val and should_replace:
            job[val_field] = incoming_val
            if incoming_src:
                job[src_field] = incoming_src

    primary_experience = primary_experience_value(
        job.get("seniority_str"),
        job.get("experience_years_str"),
    )
    if primary_experience:
        job["experience_str"] = primary_experience
        if job.get("seniority_str"):
            if job.get("seniority_src"):
                job["experience_src"] = job["seniority_src"]
        elif job.get("experience_years_src"):
            job["experience_src"] = job["experience_years_src"]

    # Extra fields
    for extra in ("skills_str", "languages_str", "work_auth_str",
                   "apply_complexity", "auto_apply_support", "parse_confidence"):
        if flat.get(extra) is not None:
            job[extra] = flat[extra]

    # Location: only set if missing
    if flat.get("location_str") and not job.get("location_str"):
        job["location_str"] = flat["location_str"]


def _build_persist_kwargs(flat: dict) -> dict:
    """Build kwargs for upsert_metadata from a flat extraction dict."""
    kwargs: dict = {}
    field_map = [
        ("work_mode_str", "work_mode_str"),
        ("work_mode_src", "work_mode_src"),
        ("job_type_str", "job_type_str"),
        ("job_type_src", "job_type_src"),
        ("seniority_str", "seniority_str"),
        ("seniority_src", "seniority_src"),
        ("experience_years_str", "experience_years_str"),
        ("experience_years_src", "experience_years_src"),
        ("experience_str", "experience_str"),
        ("experience_src", "experience_src"),
        ("salary_str", "salary_str"),
        ("salary_src", "salary_src"),
        ("apply_method_str", "apply_method_str"),
        ("apply_method_src", "apply_method_src"),
        ("skills_str", "skills_str"),
        ("languages_str", "languages_str"),
        ("work_auth_str", "work_auth_str"),
        ("parse_confidence", "parse_confidence"),
        ("apply_complexity", "apply_complexity"),
        ("auto_apply_support", "auto_apply_support"),
    ]
    for flat_key, kwarg_key in field_map:
        val = flat.get(flat_key)
        if val is not None:
            kwargs[kwarg_key] = val
    return kwargs


# ── Convenience: process a single job ─────────────────────────────

def process_single_job(job: dict) -> dict:
    """
    Synchronous single-job extraction (no AI, no DB).
    Useful for quick scoring/classification at search time.
    """
    structured = _build_structured_fields(job)

    report = extract_deterministic(
        title=job.get("title", ""),
        company=job.get("company", ""),
        description=job.get("description_snippet", ""),
        url=job.get("url", ""),
        source=job.get("source", "jobsearch"),
        location_str=job.get("location_str"),
        hr_email=job.get("hr_email"),
        apply_url=job.get("_apply_url"),
        card_data=job.get("_card_data"),
        structured_fields=structured,
    )

    flat = report.to_flat_dict()
    _apply_report_to_job(job, flat)
    return job


def _build_structured_fields(job: dict) -> dict:
    structured: dict = {}

    if job.get("work_mode_str") and job.get("work_mode_src") == "structured":
        structured["work_mode"] = job["work_mode_str"]
    if job.get("job_type_str") and job.get("job_type_src") == "structured":
        structured["job_type"] = job["job_type_str"]
    if job.get("salary_str") and job.get("salary_src") == "structured":
        structured["salary"] = job["salary_str"]
    if job.get("seniority_str") and job.get("seniority_src") == "structured":
        structured["seniority"] = job["seniority_str"]
    if job.get("experience_years_str") and job.get("experience_years_src") == "structured":
        structured["experience_years"] = job["experience_years_str"]
    if job.get("experience_str") and job.get("experience_src") == "structured":
        seniority, years = split_experience_value(job["experience_str"])
        if seniority and not structured.get("seniority"):
            structured["seniority"] = seniority
        if years and not structured.get("experience_years"):
            structured["experience_years"] = years
        if not structured.get("seniority") and not structured.get("experience_years"):
            structured["experience"] = job["experience_str"]
    if job.get("location_str"):
        structured["location"] = job["location_str"]

    return structured
