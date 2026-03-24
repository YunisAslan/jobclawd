"""
Pure scoring functions — no I/O, no external deps beyond difflib.

Produces three scores:
  1. candidateFit (match_score): 0-100, how well the job matches user profile
  2. parseConfidence: 0-100, how confident we are in the extracted metadata
  3. applyFeasibility: 0-100, how easy it is to apply to this job
"""

import difflib
from models.schemas import JobListing, UserProfile, MatchLevel, WorkMode, ExperienceLevel


def fuzzy_ratio(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, a.lower(), b.lower()).ratio()


def is_blacklisted(company: str, blacklist: list[str]) -> bool:
    for entry in blacklist:
        if fuzzy_ratio(company, entry) >= 0.75:
            return True
    return False


def is_current_employer(company: str, current_employer: str) -> bool:
    if not current_employer:
        return False
    return fuzzy_ratio(company, current_employer) >= 0.75


_WORK_MODE_KEYWORDS: dict[WorkMode, list[str]] = {
    WorkMode.remote: ["remote", "uzaqdan", "evdən", "distant", "online"],
    WorkMode.hybrid: ["hybrid", "hibrid", "qarışıq"],
    WorkMode.onsite: ["ofis", "office", "onsite", "on-site", "yerli"],
}

_EXPERIENCE_KEYWORDS: dict[ExperienceLevel, list[str]] = {
    ExperienceLevel.intern: ["intern", "internship", "stajçı", "trainee", "stajyer", "graduate"],
    ExperienceLevel.junior: ["junior", "gənc", "jr"],
    ExperienceLevel.mid: ["mid", "orta", "middle"],
    ExperienceLevel.senior: ["senior", "baş", "böyük", "experienced"],
    ExperienceLevel.lead: ["lead", "rəhbər", "head", "manager", "menencer", "chief"],
}


def score_job(job: JobListing, profile: UserProfile) -> JobListing:
    """Return a new JobListing with match_score, match_level, match_flags, and new scores set."""
    flags: list[str] = []
    title_lower = job.title.lower()
    company_lower = job.company.lower()

    # Anti-fail checks
    if is_blacklisted(job.company, profile.blacklist):
        return job.model_copy(
            update={"match_score": 0, "match_level": MatchLevel.trash, "match_flags": ["Blacklisted company"]}
        )

    if is_current_employer(job.company, profile.current_employer):
        return job.model_copy(
            update={"match_score": 0, "match_level": MatchLevel.trash, "match_flags": ["Current employer"]}
        )

    score = 0

    # --- Work mode (35 pts) ---
    # Use extracted work_mode_str first (from intelligence engine), fall back to title keywords
    detected_modes: list[WorkMode] = []
    work_mode_text = (job.work_mode_str or "").lower()
    if work_mode_text:
        for mode, keywords in _WORK_MODE_KEYWORDS.items():
            if any(kw in work_mode_text for kw in keywords):
                detected_modes.append(mode)

    if not detected_modes:
        for mode, keywords in _WORK_MODE_KEYWORDS.items():
            if any(kw in title_lower for kw in keywords):
                detected_modes.append(mode)

    if not detected_modes:
        if WorkMode.onsite in profile.work_modes or WorkMode.hybrid in profile.work_modes:
            score += 18
        else:
            score += 10
            flags.append("Work mode unclear")
    else:
        overlap = set(detected_modes) & set(profile.work_modes)
        if overlap:
            score += 35
        else:
            if profile.work_modes == [WorkMode.remote] and WorkMode.onsite in detected_modes:
                return job.model_copy(
                    update={"match_score": 0, "match_level": MatchLevel.trash, "match_flags": ["Work mode mismatch (remote only)"]}
                )
            flags.append("Work mode mismatch")
            score += 5

    # --- Experience level (25 pts) ---
    user_levels = profile.experience_level
    exp_keywords_present: list[ExperienceLevel] = []

    # Use extracted experience_str first
    exp_text = (job.experience_str or "").lower()
    if exp_text:
        for lvl, keywords in _EXPERIENCE_KEYWORDS.items():
            if any(kw in exp_text for kw in keywords):
                exp_keywords_present.append(lvl)

    if not exp_keywords_present:
        for lvl, keywords in _EXPERIENCE_KEYWORDS.items():
            if any(kw in title_lower for kw in keywords):
                exp_keywords_present.append(lvl)

    if not exp_keywords_present:
        score += 15
    elif not user_levels or any(lvl in exp_keywords_present for lvl in user_levels):
        score += 25
    else:
        flags.append("Experience level mismatch")
        score += 0

    # --- Location (20 pts) ---
    location_text = (job.location_str or "").lower()
    location_keywords = ["bakı", "baku", "baki", "azerbaijan", "azərbaycan"]
    if any(kw in location_text or kw in title_lower or kw in company_lower for kw in location_keywords):
        score += 20
    elif WorkMode.remote in profile.work_modes:
        score += 20
    elif profile.relocation:
        score += 10
    else:
        score += 15

    # --- Title match (20 pts, always full for now — frontend can refine) ---
    score += 20

    # Clamp to 0-100
    score = max(0, min(100, score))

    if score >= 75:
        level = MatchLevel.high
    elif score >= 45:
        level = MatchLevel.review
    else:
        level = MatchLevel.trash

    # --- Apply feasibility score ---
    apply_feasibility = compute_apply_feasibility(job, profile)

    # --- Summary badges ---
    badges = compute_badges(job)

    return job.model_copy(
        update={
            "match_score": score,
            "match_level": level,
            "match_flags": flags,
            "badges": badges,
        }
    )


def compute_apply_feasibility(job: JobListing, profile: UserProfile) -> int:
    """
    Score 0-100: how easy is it to apply to this job?

    Factors:
      - Apply method (email=100, easy_apply=80, external=40, direct=30)
      - Apply complexity from extraction engine
      - Profile completeness for required fields
    """
    base = {
        "email": 90,
        "easy_apply": 75,
        "external": 40,
        "direct": 30,
    }.get(job.apply_method or "direct", 30)

    # Adjust by complexity
    complexity = job.apply_complexity
    if complexity == "easy":
        base = min(100, base + 10)
    elif complexity == "hard":
        base = max(10, base - 15)

    # Bonus if we have the HR email for email apply
    if job.apply_method == "email" and job.hr_email:
        base = min(100, base + 5)

    # Bonus if auto_apply_support is full
    if job.auto_apply_support == "full":
        base = min(100, base + 5)

    # Penalty if profile is missing key fields
    missing = 0
    if not profile.cv_links:
        missing += 1
    if not profile.name:
        missing += 1
    if not profile.email:
        missing += 1
    base = max(0, base - missing * 10)

    return max(0, min(100, base))


def compute_badges(job: JobListing) -> list[str]:
    """Generate summary badges for frontend display."""
    badges: list[str] = []

    # Apply method badge
    apply_badges = {
        "email": "Email Apply",
        "easy_apply": "Easy Apply",
        "external": "External",
        "direct": "Direct",
    }
    if job.apply_method:
        badge = apply_badges.get(job.apply_method)
        if badge:
            badges.append(badge)

    # Auto-apply support badge
    if job.auto_apply_support == "full":
        badges.append("Auto-Apply Ready")
    elif job.auto_apply_support == "assisted":
        badges.append("Assisted Apply")

    # Complexity badge
    if job.apply_complexity == "easy":
        badges.append("Quick Apply")
    elif job.apply_complexity == "hard":
        badges.append("Complex Application")

    # Skills badge
    if job.skills_str:
        skill_count = len(job.skills_str.split(", "))
        if skill_count >= 5:
            badges.append(f"{skill_count} Skills Listed")

    # Salary transparency
    if job.salary_str:
        badges.append("Salary Listed")

    return badges
