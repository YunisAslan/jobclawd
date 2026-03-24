"""
Apply Readiness Service — calculates how ready a user is to apply to a specific job.

Produces:
  - readiness_score (0-100): overall readiness percentage
  - support_level: "auto" | "assisted" | "manual" | "unsupported"
  - missing_fields: list of fields the user still needs to fill
  - required_fields: list of fields this job requires
  - can_auto_apply: bool
"""

from __future__ import annotations

from typing import Optional
from models.schemas import UserProfile, JobListing, JobDetailResponse


# ── Required fields per apply method ──────────────────────────────

# Base fields always needed
_BASE_FIELDS = ["name", "email", "cv"]

# Per-method required fields
_METHOD_FIELDS: dict[str, list[str]] = {
    "email": [*_BASE_FIELDS, "cover_letter"],
    "easy_apply": [*_BASE_FIELDS, "phone", "linkedin_url"],
    "external": [*_BASE_FIELDS, "phone"],
    "direct": [*_BASE_FIELDS],
}

# Fields that boost readiness but aren't strictly required
_BONUS_FIELDS: dict[str, list[str]] = {
    "email": ["phone", "linkedin_url"],
    "easy_apply": ["portfolio_url", "work_authorization", "salary_expectation"],
    "external": ["linkedin_url", "portfolio_url", "work_authorization", "salary_expectation", "education"],
    "direct": ["phone", "linkedin_url"],
}

# Human-readable labels
_FIELD_LABELS: dict[str, str] = {
    "name": "Full name",
    "email": "Email address",
    "cv": "Resume / CV",
    "phone": "Phone number",
    "linkedin_url": "LinkedIn URL",
    "portfolio_url": "Portfolio URL",
    "github_url": "GitHub URL",
    "cover_letter": "Cover letter",
    "work_authorization": "Work authorization",
    "salary_expectation": "Salary expectation",
    "education": "Education",
    "skills": "Skills",
    "languages": "Language levels",
    "experience": "Years of experience",
    "notice_period": "Notice period",
    "availability": "Availability / start date",
}


def _check_field(profile: Optional[UserProfile], field: str) -> bool:
    """Check if a profile field is filled."""
    if not profile:
        return False
    checks: dict[str, bool] = {
        "name": bool((profile.name or "").strip()),
        "email": bool((profile.email or "").strip()),
        "cv": len(profile.cv_links) > 0,
        "phone": bool((profile.phone or "").strip()),
        "linkedin_url": bool((profile.linkedin_url or "").strip()),
        "portfolio_url": bool((profile.portfolio_url or "").strip()),
        "github_url": bool((profile.github_url or "").strip()),
        "cover_letter": len(profile.cover_letter_templates) > 0,
        "work_authorization": bool((profile.work_authorization or "").strip()),
        "salary_expectation": bool((profile.salary_min or "").strip()),
        "education": len(profile.education) > 0,
        "skills": len(profile.skills) > 0,
        "languages": len(profile.language_levels) > 0,
        "experience": profile.years_of_experience is not None,
        "notice_period": bool((profile.notice_period or "").strip()),
        "availability": bool((profile.availability or "").strip()),
    }
    return checks.get(field, False)


def compute_apply_readiness(
    profile: Optional[UserProfile],
    job: JobListing,
    detail: Optional[JobDetailResponse] = None,
) -> dict:
    """
    Compute apply readiness for a specific job + profile combination.

    Returns dict with:
      - score: 0-100
      - support_level: "auto" | "assisted" | "manual" | "unsupported"
      - support_label: human-readable label
      - missing_required: list of {field, label} that are required but missing
      - missing_optional: list of {field, label} that would improve the application
      - can_auto_apply: bool
      - method: resolved apply method
      - method_label: human-readable method label
    """
    # Resolve apply method
    method = "direct"
    if detail and detail.apply_method:
        method = detail.apply_method.value if hasattr(detail.apply_method, "value") else detail.apply_method
    elif job.apply_method:
        method = job.apply_method

    required = _METHOD_FIELDS.get(method, _BASE_FIELDS)
    bonus = _BONUS_FIELDS.get(method, [])

    # Check which required fields are filled
    missing_required: list[dict] = []
    filled_required = 0
    for field in required:
        if _check_field(profile, field):
            filled_required += 1
        else:
            missing_required.append({"field": field, "label": _FIELD_LABELS.get(field, field)})

    # Check which bonus fields are filled
    missing_optional: list[dict] = []
    filled_bonus = 0
    for field in bonus:
        if field in required:
            continue
        if _check_field(profile, field):
            filled_bonus += 1
        else:
            missing_optional.append({"field": field, "label": _FIELD_LABELS.get(field, field)})

    # Score: 80% weight on required fields, 20% on bonus
    total_required = len(required)
    total_bonus = len(bonus) - len([b for b in bonus if b in required])

    required_pct = (filled_required / total_required * 100) if total_required > 0 else 100
    bonus_pct = (filled_bonus / total_bonus * 100) if total_bonus > 0 else 100

    score = int(required_pct * 0.8 + bonus_pct * 0.2)
    score = max(0, min(100, score))

    # Determine support level
    support_level, support_label = _classify_support(method, job, detail, score)

    # Can auto-apply?
    can_auto = (
        support_level == "auto"
        and len(missing_required) == 0
        and method == "email"
    )

    # Method label
    method_labels = {
        "email": "Apply via Email",
        "easy_apply": "Easy Apply",
        "external": "External Application",
        "direct": "Direct Application",
    }

    return {
        "score": score,
        "support_level": support_level,
        "support_label": support_label,
        "missing_required": missing_required,
        "missing_optional": missing_optional,
        "can_auto_apply": can_auto,
        "method": method,
        "method_label": method_labels.get(method, "Apply"),
    }


def _classify_support(
    method: str,
    job: JobListing,
    detail: Optional[JobDetailResponse],
    score: int,
) -> tuple[str, str]:
    """
    Classify the automation support level for this job.

    Returns (support_level, support_label):
      "auto"        → "Auto Apply — Supported"
      "assisted"    → "Assisted Apply"
      "manual"      → "Manual Required"
      "unsupported" → "Unsupported"
    """
    if method == "email":
        hr_email = job.hr_email or (detail.email if detail else None)
        if hr_email and score >= 80:
            return "auto", "Auto Apply — Supported"
        if hr_email:
            return "assisted", "Email Apply — Complete your profile"
        return "manual", "Email Apply — No recruiter email found"

    if method == "easy_apply":
        # Check tier from detail
        if detail and detail.easy_apply:
            tier = detail.easy_apply.tier
            if tier == "A":
                return "assisted", "Easy Apply — Supported"
            if tier == "B":
                return "assisted", "Easy Apply — Assisted"
            if tier == "C":
                return "manual", "Easy Apply — Complex, needs review"
        return "assisted", "Easy Apply — Assisted"

    if method == "external":
        if detail and detail.ats_info and detail.ats_info.platform:
            platform = detail.ats_info.platform_label or detail.ats_info.platform
            if detail.ats_info.confidence >= 0.8:
                return "assisted", f"External Apply — {platform} (Assisted)"
            return "manual", f"External Apply — {platform}"
        return "manual", "External Apply — Manual Required"

    # direct
    return "manual", "Direct Apply — Manual Required"
