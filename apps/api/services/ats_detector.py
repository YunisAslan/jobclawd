"""
Detect ATS platform from external job application URLs and pages.

Supports: Greenhouse, Lever, Workable, SmartRecruiters, BreezyHR, Ashby,
          and generic career page patterns.

For each detected platform, reports which fields can be auto-filled from
the user profile and which require manual input.
"""
import re
from typing import Optional
from models.schemas import ATSInfo


# ATS URL patterns → (platform_key, label, confidence)
ATS_URL_PATTERNS: list[tuple[str, str, str, float]] = [
    (r"boards\.greenhouse\.io", "greenhouse", "Greenhouse", 1.0),
    (r"job-boards\.greenhouse\.io", "greenhouse", "Greenhouse", 1.0),
    (r"greenhouse\.io/embed", "greenhouse", "Greenhouse", 0.9),
    (r"jobs\.lever\.co", "lever", "Lever", 1.0),
    (r"apply\.workable\.com", "workable", "Workable", 1.0),
    (r"jobs\.smartrecruiters\.com", "smartrecruiters", "SmartRecruiters", 1.0),
    (r"breezy\.hr", "breezy", "BreezyHR", 1.0),
    (r"app\.breezy\.hr", "breezy", "BreezyHR", 1.0),
    (r"jobs\.ashbyhq\.com", "ashby", "Ashby", 1.0),
    (r"myworkdayjobs\.com", "workday", "Workday", 1.0),
    (r"wd\d+\.myworkday", "workday", "Workday", 0.9),
    (r"icims\.com", "icims", "iCIMS", 0.9),
    (r"taleo\.net", "taleo", "Taleo", 0.9),
    (r"jobvite\.com", "jobvite", "Jobvite", 0.9),
    (r"jazz\.co", "jazzhr", "JazzHR", 0.9),
    (r"recruitee\.com", "recruitee", "Recruitee", 0.9),
]

# ATS page-source patterns (checked in HTML when URL detection fails)
ATS_PAGE_PATTERNS: list[tuple[str, str, str, float]] = [
    (r"greenhouse", "greenhouse", "Greenhouse", 0.7),
    (r"lever-jobs-iframe", "lever", "Lever", 0.8),
    (r"workable-apply", "workable", "Workable", 0.7),
    (r"smartrecruiters", "smartrecruiters", "SmartRecruiters", 0.7),
    (r"breezyhr|breezy-hr", "breezy", "BreezyHR", 0.7),
    (r"ashbyhq", "ashby", "Ashby", 0.7),
]

# Standard fields per ATS platform that can be auto-filled
ATS_FIELD_MAP: dict[str, dict] = {
    "greenhouse": {
        "prefillable": [
            "first_name", "last_name", "email", "phone", "resume",
            "linkedin_url", "website", "location",
        ],
        "common_extra": [
            "cover_letter", "education", "how_did_you_hear",
        ],
    },
    "lever": {
        "prefillable": [
            "full_name", "email", "phone", "resume",
            "linkedin_url", "github_url", "portfolio_url", "location",
        ],
        "common_extra": [
            "cover_letter", "additional_info",
        ],
    },
    "workable": {
        "prefillable": [
            "first_name", "last_name", "email", "phone", "resume",
            "education", "experience", "location",
        ],
        "common_extra": [
            "cover_letter", "summary", "skills",
        ],
    },
    "smartrecruiters": {
        "prefillable": [
            "first_name", "last_name", "email", "phone", "resume",
            "linkedin_url", "location",
        ],
        "common_extra": [
            "cover_letter", "education", "experience",
        ],
    },
    "breezy": {
        "prefillable": [
            "full_name", "email", "phone", "resume",
            "linkedin_url", "location",
        ],
        "common_extra": [
            "cover_letter", "portfolio",
        ],
    },
    "ashby": {
        "prefillable": [
            "full_name", "email", "phone", "resume",
            "linkedin_url", "github_url", "portfolio_url",
        ],
        "common_extra": [
            "cover_letter", "salary_expectation",
        ],
    },
    "workday": {
        "prefillable": [
            "first_name", "last_name", "email", "phone",
        ],
        "common_extra": [
            "resume", "cover_letter", "education", "experience",
            "work_authorization", "address", "references",
        ],
    },
    "icims": {
        "prefillable": [
            "first_name", "last_name", "email", "phone",
        ],
        "common_extra": [
            "resume", "cover_letter", "education", "address",
            "work_authorization",
        ],
    },
    "taleo": {
        "prefillable": [
            "first_name", "last_name", "email", "phone",
        ],
        "common_extra": [
            "resume", "cover_letter", "education", "experience",
            "work_authorization", "address",
        ],
    },
    "jobvite": {
        "prefillable": [
            "first_name", "last_name", "email", "phone", "resume",
            "linkedin_url",
        ],
        "common_extra": [
            "cover_letter",
        ],
    },
    "jazzhr": {
        "prefillable": [
            "first_name", "last_name", "email", "phone", "resume",
            "location",
        ],
        "common_extra": [
            "cover_letter", "linkedin_url",
        ],
    },
    "recruitee": {
        "prefillable": [
            "full_name", "email", "phone", "resume",
            "linkedin_url", "portfolio_url",
        ],
        "common_extra": [
            "cover_letter",
        ],
    },
}


def _detect_from_url(url: str) -> Optional[tuple[str, str, float]]:
    """Try to identify ATS from URL patterns."""
    for pattern, key, label, confidence in ATS_URL_PATTERNS:
        if re.search(pattern, url, re.IGNORECASE):
            return key, label, confidence
    return None


def _detect_from_html(html: str) -> Optional[tuple[str, str, float]]:
    """Fallback: scan page HTML for ATS indicators."""
    lower = html[:50000].lower()  # only scan first 50k chars
    for pattern, key, label, confidence in ATS_PAGE_PATTERNS:
        if re.search(pattern, lower):
            return key, label, confidence
    return None


async def detect_ats(page, url: str) -> Optional[ATSInfo]:
    """
    Detect ATS platform from the job URL and page content.
    Returns ATSInfo if a known ATS is detected, None otherwise.
    """
    # Skip LinkedIn and jobsearch.az — those are handled separately
    if "linkedin.com" in url or "jobsearch.az" in url:
        return None

    # 1. URL-based detection (fast, high confidence)
    result = _detect_from_url(url)

    # 2. Page HTML fallback
    if not result:
        try:
            html = await page.content()
            result = _detect_from_html(html)
        except Exception:
            pass

    # 3. Check for apply links/iframes that redirect to known ATS
    if not result:
        try:
            ats_links = await page.evaluate("""
                () => {
                    const links = document.querySelectorAll('a[href], iframe[src]');
                    const hrefs = [];
                    links.forEach(el => {
                        const href = el.getAttribute('href') || el.getAttribute('src') || '';
                        if (href) hrefs.push(href);
                    });
                    return hrefs;
                }
            """)
            for link in (ats_links or []):
                r = _detect_from_url(link)
                if r:
                    result = (r[0], r[1], r[2] * 0.8)  # lower confidence for embedded
                    break
        except Exception:
            pass

    if not result:
        return None

    platform_key, platform_label, confidence = result
    field_info = ATS_FIELD_MAP.get(platform_key, {"prefillable": [], "common_extra": []})

    # Try to find the actual application form URL
    apply_url = None
    try:
        apply_url = await page.evaluate("""
            () => {
                const selectors = [
                    'a[href*="apply"]', 'a[href*="application"]',
                    'a[class*="apply"]', 'button[class*="apply"]',
                    '[data-qa="apply-button"] a', '.apply-btn a',
                ];
                for (const sel of selectors) {
                    const el = document.querySelector(sel);
                    if (el && el.href) return el.href;
                }
                return null;
            }
        """)
    except Exception:
        pass

    return ATSInfo(
        platform=platform_key,
        platform_label=platform_label,
        confidence=round(confidence, 2),
        prefillable_fields=field_info["prefillable"],
        missing_fields=field_info["common_extra"],
        apply_url=apply_url,
    )
