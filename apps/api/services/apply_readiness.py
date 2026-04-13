"""
Apply Readiness Service — calculates how ready a user profile is for a job application.
"""

from __future__ import annotations

from typing import Optional
from models.schemas import UserProfile, JobListing, JobDetailResponse


# ── Readiness field groups ────────────────────────────────────────

_CORE_FIELDS = ["name", "email", "cv"]
_PROFILE_FIELDS: list[str] = []
_COMPETITIVE_FIELDS: list[str] = []

# Human-readable labels
_FIELD_LABELS: dict[str, str] = {
    "name": "Full name",
    "email": "Email address",
    "cv": "Resume / CV",
}


def _check_field(profile: Optional[UserProfile], field: str) -> bool:
    """Check if a profile field is filled."""
    if not profile:
        return False
    checks: dict[str, bool] = {
        "name": bool((profile.name or "").strip()),
        "email": bool((profile.email or "").strip()),
        "cv": len(profile.cv_links) > 0,
    }
    return checks.get(field, False)


def compute_apply_readiness(
    profile: Optional[UserProfile],
    job: JobListing,
    detail: Optional[JobDetailResponse] = None,
) -> dict:
    """
    Compute generic application readiness for a specific job + profile combination.
    """
    del job, detail

    missing_required: list[dict] = []
    filled_core = 0
    for field in _CORE_FIELDS:
        if _check_field(profile, field):
            filled_core += 1
        else:
            missing_required.append({"field": field, "label": _FIELD_LABELS.get(field, field)})

    missing_optional: list[dict] = []
    filled_optional = 0
    optional_fields = [*_PROFILE_FIELDS, *_COMPETITIVE_FIELDS]
    for field in optional_fields:
        if _check_field(profile, field):
            filled_optional += 1
        else:
            missing_optional.append({"field": field, "label": _FIELD_LABELS.get(field, field)})

    core_pct = (filled_core / len(_CORE_FIELDS) * 100) if _CORE_FIELDS else 100
    optional_pct = (filled_optional / len(optional_fields) * 100) if optional_fields else 100
    score = int(core_pct * 0.75 + optional_pct * 0.25)
    score = max(0, min(100, score))

    readiness_level, readiness_label = _classify_readiness(score)

    return {
        "score": score,
        "readiness_level": readiness_level,
        "readiness_label": readiness_label,
        "missing_required": missing_required,
        "missing_optional": missing_optional,
    }


def _classify_readiness(
    score: int,
) -> tuple[str, str]:
    """
    Classify overall profile readiness in generic application terms.
    """
    if score >= 85:
        return "ready", "Ready to apply"
    if score >= 60:
        return "partial", "Almost ready"
    return "basic", "Profile needs more details"
