"""
Pure scoring functions — no I/O, no external deps beyond difflib.
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
    """Return a new JobListing with match_score, match_level, match_flags set."""
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
    detected_modes: list[WorkMode] = []
    for mode, keywords in _WORK_MODE_KEYWORDS.items():
        if any(kw in title_lower for kw in keywords):
            detected_modes.append(mode)

    if not detected_modes:
        # No mode info in title — partial credit if user allows onsite
        if WorkMode.onsite in profile.work_modes or WorkMode.hybrid in profile.work_modes:
            score += 18
        else:
            # User wants only remote, job gives no signal — soft mismatch
            score += 10
            flags.append("Work mode unclear")
    else:
        overlap = set(detected_modes) & set(profile.work_modes)
        if overlap:
            score += 35
        else:
            # Hard mismatch: user is strictly remote, job is onsite
            if profile.work_modes == [WorkMode.remote] and WorkMode.onsite in detected_modes:
                return job.model_copy(
                    update={"match_score": 0, "match_level": MatchLevel.trash, "match_flags": ["Work mode mismatch (remote only)"]}
                )
            flags.append("Work mode mismatch")
            score += 5

    # --- Experience level (25 pts) ---
    user_levels = profile.experience_level  # list[ExperienceLevel]
    exp_keywords_present: list[ExperienceLevel] = []
    for lvl, keywords in _EXPERIENCE_KEYWORDS.items():
        if any(kw in title_lower for kw in keywords):
            exp_keywords_present.append(lvl)

    if not exp_keywords_present:
        score += 15  # no info, neutral
    elif not user_levels or any(lvl in exp_keywords_present for lvl in user_levels):
        score += 25
    else:
        flags.append("Experience level mismatch")
        score += 0

    # --- Location (20 pts) ---
    location_keywords = ["bakı", "baku", "baki", "azerbaijan", "azərbaycan"]
    if any(kw in title_lower or kw in company_lower for kw in location_keywords):
        score += 20
    elif WorkMode.remote in profile.work_modes:
        score += 20  # remote users don't care about location
    elif profile.relocation:
        score += 10
    else:
        score += 15  # assume local by default

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

    return job.model_copy(
        update={"match_score": score, "match_level": level, "match_flags": flags}
    )
