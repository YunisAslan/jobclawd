"""
Job Deduplication System — fingerprinting and cross-platform duplicate detection.

Strategy:
  1. Compute a fingerprint from normalized (title + company + location)
  2. Check against DB for existing fingerprints (cross-platform dedup)
  3. If a duplicate is found, reuse its cached extraction results

The fingerprint is source-independent, so the same job posted on
LinkedIn and Indeed will share a single fingerprint.
"""

from __future__ import annotations

import hashlib
import re
from typing import Optional

from db.database import get_db


# ── Normalization ──────────────────────────────────────────────────

_COMPANY_SUFFIXES = re.compile(
    r'\b(?:inc\.?|ltd\.?|llc\.?|corp(?:oration)?\.?|co\.?|gmbh|ag|sa|plc|pty|pvt'
    r'|mmc|qsc|asc|ooo|ооо|ao|ао)\b',
    re.IGNORECASE,
)
_NON_ALNUM = re.compile(r'[^a-z0-9\s]')
_MULTI_SPACE = re.compile(r'\s+')

# Location aliases that should normalize to the same thing
_LOCATION_ALIASES: dict[str, str] = {
    "bakı": "baku", "баку": "baku", "baki": "baku",
    "new york city": "new york", "nyc": "new york", "ny": "new york",
    "san francisco": "sf", "sf": "sf",
    "los angeles": "la", "la": "la",
    "london": "london", "лондон": "london",
}


def _normalize_text(text: str) -> str:
    """Lowercase, strip non-alphanumeric, collapse whitespace."""
    t = (text or "").lower().strip()
    t = _NON_ALNUM.sub(" ", t)
    t = _MULTI_SPACE.sub(" ", t).strip()
    return t


def _normalize_company(company: str) -> str:
    """Normalize company name: remove legal suffixes and noise."""
    t = (company or "").lower().strip()
    t = _COMPANY_SUFFIXES.sub("", t)
    t = _NON_ALNUM.sub(" ", t)
    t = _MULTI_SPACE.sub(" ", t).strip()
    return t


def _normalize_location(location: str) -> str:
    """Normalize location for comparison."""
    t = (location or "").lower().strip()
    t = _NON_ALNUM.sub(" ", t)
    t = _MULTI_SPACE.sub(" ", t).strip()
    return _LOCATION_ALIASES.get(t, t)


def compute_fingerprint(
    title: str,
    company: str,
    location: Optional[str] = None,
) -> str:
    """
    Compute a deterministic fingerprint for cross-platform dedup.
    Same job on different platforms → same fingerprint.
    """
    parts = [
        _normalize_text(title),
        _normalize_company(company),
    ]
    if location:
        parts.append(_normalize_location(location))

    canonical = "|".join(parts)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:32]


# ── Batch dedup in search results ─────────────────────────────────

def deduplicate_jobs(jobs: list[dict]) -> list[dict]:
    """
    Remove cross-platform duplicates from a list of job dicts.
    Keeps the version with the most metadata.

    Jobs must have: title, company, url, source.
    Optional: location_str.
    """
    if not jobs:
        return []

    fingerprint_map: dict[str, list[dict]] = {}
    url_set: set[str] = set()

    for job in jobs:
        url = job.get("url", "")
        # URL-level dedup first (cheapest check)
        if url in url_set:
            continue
        url_set.add(url)

        fp = compute_fingerprint(
            title=job.get("title", ""),
            company=job.get("company", ""),
            location=job.get("location_str"),
        )
        job["_fingerprint"] = fp
        fingerprint_map.setdefault(fp, []).append(job)

    # For each fingerprint group, keep the "best" version
    result: list[dict] = []
    for fp, group in fingerprint_map.items():
        if len(group) == 1:
            result.append(group[0])
        else:
            # Score each version by metadata completeness
            best = max(group, key=_metadata_richness)
            # Carry forward any metadata from other versions
            for other in group:
                if other is not best:
                    _merge_metadata(best, other)
            result.append(best)

    return result


def _metadata_richness(job: dict) -> int:
    """Count how many metadata fields are populated."""
    score = 0
    for field in (
        "work_mode_str", "job_type_str", "salary_str", "experience_str",
        "hr_email", "apply_method", "description_snippet", "logo_url",
    ):
        if job.get(field):
            score += 1
    # Prefer structured source data
    for src_field in ("work_mode_src", "job_type_src", "salary_src", "experience_src"):
        if job.get(src_field) == "structured":
            score += 2
    return score


def _merge_metadata(target: dict, donor: dict) -> None:
    """Copy non-empty metadata from donor to target where target is missing it."""
    field_pairs = [
        ("work_mode_str", "work_mode_src"),
        ("job_type_str", "job_type_src"),
        ("salary_str", "salary_src"),
        ("experience_str", "experience_src"),
    ]
    for value_field, source_field in field_pairs:
        if not target.get(value_field) and donor.get(value_field):
            target[value_field] = donor[value_field]
            if donor.get(source_field):
                target[source_field] = donor[source_field]

    # Also merge HR email and apply_method
    if not target.get("hr_email") and donor.get("hr_email"):
        target["hr_email"] = donor["hr_email"]
    if (not target.get("apply_method") or target.get("apply_method") == "direct") and donor.get("apply_method"):
        target["apply_method"] = donor["apply_method"]


# ── DB-backed fingerprint cache ───────────────────────────────────

def get_cached_fingerprints(fingerprints: list[str]) -> dict[str, dict]:
    """
    Look up existing extraction results by fingerprint.
    Returns {fingerprint: metadata_dict}.
    """
    if not fingerprints:
        return {}
    try:
        with get_db() as conn:
            rows = conn.execute(
                "SELECT fingerprint, url, experience_str, experience_src, "
                "job_type_str, job_type_src, salary_str, salary_src, "
                "work_mode_str, work_mode_src, apply_method_str, apply_method_src, "
                "skills_str, languages_str, work_auth_str, parse_confidence "
                "FROM job_metadata WHERE fingerprint = ANY(%s) AND expires_at > NOW()",
                (fingerprints,),
            ).fetchall()
        result: dict[str, dict] = {}
        for row in rows:
            d = dict(row)
            fp = d.pop("fingerprint")
            d.pop("url", None)
            cleaned = {k: v for k, v in d.items() if v is not None}
            if cleaned:
                result[fp] = cleaned
        return result
    except Exception:
        # Column may not exist yet on first run
        return {}


def store_fingerprint(url: str, fingerprint: str) -> None:
    """Associate a fingerprint with a job URL in the metadata table."""
    with get_db() as conn:
        conn.execute(
            "UPDATE job_metadata SET fingerprint = %s WHERE url = %s",
            (fingerprint, url),
        )
