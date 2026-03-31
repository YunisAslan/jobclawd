"""
Pure scoring functions — no I/O, no external deps beyond difflib.

Produces match scoring plus lightweight summary badges.
"""

import difflib
from models.schemas import JobListing, UserProfile, MatchLevel, WorkMode, ExperienceLevel
from utils.job_meta_extractor import primary_experience_value


def fuzzy_ratio(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, a.lower(), b.lower()).ratio()


def is_blacklisted(company: str, blacklist: list[str]) -> bool:
    for entry in blacklist:
        if fuzzy_ratio(company, entry) >= 0.75:
            return True
    return False


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
    exp_text = (
        primary_experience_value(job.seniority_str, job.experience_years_str)
        or job.experience_str
        or ""
    ).lower()
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


def compute_badges(job: JobListing) -> list[str]:
    """Generate summary badges for frontend display."""
    badges: list[str] = []

    # Skills badge
    if job.skills_str:
        skill_count = len(job.skills_str.split(", "))
        if skill_count >= 5:
            badges.append(f"{skill_count} Skills Listed")

    # Salary transparency
    if job.salary_str:
        badges.append("Salary Listed")

    return badges
