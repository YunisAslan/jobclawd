"""
Resolve the real application destination URL for a vacancy.

Key design rules:
  - NEVER fabricate URLs by appending /apply, /application, ?jobId= etc.
    These often land on login walls, 404s, or wrong pages.
  - ONLY return URLs that were actually found on the page as clickable links.
  - The vacancy URL itself is always a safe fallback — user can navigate from there.
  - Login-required ATS platforms (Workday, iCIMS, Taleo, LinkedIn) are flagged
    so the frontend can warn the user instead of opening a dead-end.
  - No blind redirect following — unauthenticated HEAD requests hit login walls.

Pipeline:
  1. Classify URL → known ATS domain? listing page?
  2. If already on a public ATS (Greenhouse, Lever, Workable) → use as-is
  3. Extract outbound apply links from page HTML
  4. Score links, prefer known-public ATS destinations
  5. Return best link + original URL as fallback
"""

import re
from dataclasses import dataclass, field
from typing import Optional


# ── Result ────────────────────────────────────────────────────────────

@dataclass
class ResolvedApplyLink:
    """Result of apply-link resolution."""
    apply_url: str                          # Best resolved URL
    confidence: float = 0.0                 # 0.0–1.0
    ats_platform: Optional[str] = None      # greenhouse | lever | ashby | …
    requires_login: bool = False            # True → warn user, don't auto-open
    fallback_urls: list[str] = field(default_factory=list)
    evidence: str = ""


# ── ATS classification ────────────────────────────────────────────────

# Public ATS: form is on the job page itself, no login required
_PUBLIC_ATS = {"greenhouse", "lever", "workable", "ashby", "breezy", "recruitee"}

# Login-required ATS: user needs an account; opening the link cold = login wall
_LOGIN_ATS = {"workday", "icims", "taleo", "smartrecruiters"}

# LinkedIn Easy Apply requires being logged into LinkedIn
_EASY_APPLY_SOURCES = {"linkedin"}


def _detect_ats_from_url(url: str) -> Optional[tuple[str, str, float]]:
    """Return (platform_key, label, confidence) if URL matches a known ATS."""
    for pattern, key, label, conf in ATS_URL_PATTERNS:
        if re.search(pattern, url, re.IGNORECASE):
            return key, label, conf
    return None


def _is_public_ats(platform: str) -> bool:
    return platform in _PUBLIC_ATS


def _requires_login(platform: str) -> bool:
    return platform in _LOGIN_ATS


# ── Listing-page patterns ────────────────────────────────────────────

_LISTING_DOMAINS = [
    "jobsearch.az",
    "linkedin.com",
    "indeed.com",
    "az.indeed.com",
    "glassdoor.com",
]


def _is_listing_page(url: str) -> bool:
    return any(d in url for d in _LISTING_DOMAINS)


# ── Link exclusion patterns (login / noise URLs to skip) ─────────────

_EXCLUDE_PATTERNS = re.compile(
    r"login|sign.?in|sign.?up|register|create.?account|forgot.?password|"
    r"oauth|callback|sso|auth|cookie|privacy|terms|legal|"
    r"unsubscribe|mailto:|javascript:|#$",
    re.IGNORECASE,
)


def _is_noise_link(href: str) -> bool:
    """Filter out links that are clearly not application forms."""
    return bool(_EXCLUDE_PATTERNS.search(href))


# ── Page-level link extraction ────────────────────────────────────────

async def _extract_apply_links_from_page(page) -> list[str]:
    """Extract outbound apply-related links from the current page.
    Filters out login, auth, and noise URLs."""
    try:
        return await page.evaluate("""
            () => {
                const links = [];
                const seen = new Set();

                // Only look for apply-specific selectors — not generic 'a' tags
                const selectors = [
                    '#apply-button a',
                    '.vacancy__apply a',
                    '.apply-btn',
                    '.apply-button a',
                    'a[class*="apply"]',
                    'a[href*="greenhouse.io"]',
                    'a[href*="lever.co"]',
                    'a[href*="ashbyhq.com"]',
                    'a[href*="workable.com"]',
                ];

                const noiseRe = /login|sign.?in|sign.?up|register|create.?account|oauth|sso|auth|cookie|privacy|terms|mailto:|javascript:/i;

                for (const sel of selectors) {
                    try {
                        const els = document.querySelectorAll(sel);
                        for (const el of els) {
                            // Only visible elements
                            const style = window.getComputedStyle(el);
                            if (style.display === 'none' || style.visibility === 'hidden') continue;

                            const href = el.getAttribute('href') || '';
                            if (!href || href.startsWith('#') || href.startsWith('javascript:'))
                                continue;

                            const abs = href.startsWith('http') ? href : new URL(href, location.origin).href;

                            if (noiseRe.test(abs)) continue;
                            if (seen.has(abs)) continue;

                            seen.add(abs);
                            links.push(abs);
                        }
                    } catch {}
                }

                return links.slice(0, 20);
            }
        """)
    except Exception:
        return []


# ── Main resolver ─────────────────────────────────────────────────────

async def resolve_apply_link(
    page,
    url: str,
) -> ResolvedApplyLink:
    """
    Resolve the best application destination URL.

    Returns the original vacancy URL as default — only overrides when
    we have a high-confidence outbound link to a public ATS form.
    """

    # ── 1. URL itself is a known ATS ─────────────────────────────────
    ats_match = _detect_ats_from_url(url)
    if ats_match:
        platform_key, _, conf = ats_match
        return ResolvedApplyLink(
            apply_url=url,  # Use as-is — don't fabricate canonical URLs
            confidence=min(conf, 0.95),
            ats_platform=platform_key,
            requires_login=_requires_login(platform_key),
            evidence=f"Already on {platform_key} — use this page",
        )

    # ── 2. Extract outbound links from page ──────────────────────────
    page_links = await _extract_apply_links_from_page(page)

    best_link: Optional[str] = None
    best_score: float = 0.0
    best_platform: Optional[str] = None
    best_requires_login: bool = False

    for link in page_links:
        if _is_noise_link(link):
            continue

        score = 0.0
        platform = None
        login_required = False

        # Known ATS URL?
        ats_check = _detect_ats_from_url(link)
        if ats_check:
            platform = ats_check[0]
            if _is_public_ats(platform):
                score = 0.90  # High confidence — public form
            else:
                score = 0.60  # Lower — might be login wall
                login_required = True

        # External domain from a listing page (company career site)?
        if not platform and _is_listing_page(url):
            try:
                from urllib.parse import urlsplit
                link_host = urlsplit(link).netloc
                page_host = urlsplit(url).netloc
                if link_host and link_host != page_host:
                    score = max(score, 0.55)
            except Exception:
                pass

        if score > best_score:
            best_score = score
            best_link = link
            best_platform = platform
            best_requires_login = login_required

    if best_link and best_score >= 0.55:
        return ResolvedApplyLink(
            apply_url=best_link,
            confidence=round(min(best_score, 0.95), 2),
            ats_platform=best_platform,
            requires_login=best_requires_login,
            fallback_urls=[url],
            evidence=f"Outbound apply link found on page (score={best_score:.2f})",
        )

    # ── 3. Fallback: original vacancy URL ────────────────────────────
    return ResolvedApplyLink(
        apply_url=url,
        confidence=0.50 if not _is_listing_page(url) else 0.30,
        evidence="Using vacancy URL — apply from the listing page",
    )
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
