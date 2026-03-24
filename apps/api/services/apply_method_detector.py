"""
Detect how a vacancy requires applying — from search data and page content.

Two modes:
  1. Search-time: fast detection from card data, URL, email (delegates to extraction.deterministic)
  2. Detail-time: deep analysis from the actual page DOM (enhanced page scanner)

Returns one of: "email" | "easy_apply" | "external" | "direct"
Each with a confidence score when using the confidence-aware API.
"""

import re
from typing import Optional

from services.extraction.confidence import FieldResult
from services.extraction.deterministic import detect_apply_method, classify_apply_complexity


# ── Legacy API (backward-compatible, used by existing scrapers) ────

def detect_from_jobsearch_item(item: dict, hr_email: Optional[str]) -> str:
    """Detect apply method from a jobsearch.az API item at search time."""
    result = detect_apply_method(source="jobsearch", hr_email=hr_email, card_data=item)
    return result.value or "direct"


def detect_from_linkedin_card(card_data: dict) -> str:
    """Detect apply method from a LinkedIn search card."""
    result = detect_apply_method(source="linkedin", card_data=card_data)
    return result.value or "external"


def detect_from_indeed_card(card_data: dict) -> str:
    """Detect apply method from an Indeed search card."""
    result = detect_apply_method(source="indeed", card_data=card_data)
    return result.value or "external"


# ── Confidence-aware API (new) ─────────────────────────────────────

def detect_from_jobsearch_item_conf(item: dict, hr_email: Optional[str]) -> FieldResult:
    """Detect apply method with confidence from jobsearch.az."""
    return detect_apply_method(source="jobsearch", hr_email=hr_email, card_data=item)


def detect_from_linkedin_card_conf(card_data: dict, *, apply_url: Optional[str] = None) -> FieldResult:
    """Detect apply method with confidence from LinkedIn."""
    return detect_apply_method(source="linkedin", card_data=card_data, apply_url=apply_url)


def detect_from_indeed_card_conf(card_data: dict) -> FieldResult:
    """Detect apply method with confidence from Indeed."""
    return detect_apply_method(source="indeed", card_data=card_data)


# ── Page-level detection (enhanced) ───────────────────────────────

# Patterns in description text that indicate "send CV to this email"
_EMAIL_APPLY_PATTERNS = re.compile(
    r"(?:send|submit|email|forward|attach).{0,40}(?:cv|resume|application)|"
    r"(?:cv|resume|application).{0,40}(?:send|submit|email|forward)|"
    r"göndər.{0,30}(?:cv|resume)|"
    r"müraciət.{0,20}e-?mail|"
    r"apply\s+(?:via|by|through)\s+e?-?mail|"
    r"отправ.{0,20}(?:резюме|cv)|"
    r"направ.{0,20}(?:резюме|cv)",
    re.IGNORECASE,
)

# Patterns that indicate "apply on external site / company website"
_EXTERNAL_APPLY_PATTERNS = re.compile(
    r"apply\s+(?:on|at|through|via)\s+(?:our|the|company)\s+(?:website|site|portal|page)|"
    r"apply\s+(?:here|directly)\s+(?:on|at)|"
    r"click\s+(?:here|the\s+link)\s+to\s+apply|"
    r"visit\s+.{0,30}to\s+apply|"
    r"application\s+(?:link|url|portal)|"
    r"müraciət\s+linki|"
    r"подать\s+заявку\s+(?:на|через)|"
    r"перейти\s+по\s+ссылке",
    re.IGNORECASE,
)

# ATS URL patterns for apply button href analysis
_ATS_EXTERNAL_PATTERNS = [
    re.compile(r"boards\.greenhouse\.io|job-boards\.greenhouse\.io", re.I),
    re.compile(r"jobs\.lever\.co", re.I),
    re.compile(r"apply\.workable\.com", re.I),
    re.compile(r"jobs\.smartrecruiters\.com", re.I),
    re.compile(r"myworkdayjobs\.com|wd\d+\.myworkday", re.I),
    re.compile(r"icims\.com", re.I),
    re.compile(r"taleo\.net", re.I),
    re.compile(r"jobvite\.com", re.I),
    re.compile(r"breezy\.hr|app\.breezy\.hr", re.I),
    re.compile(r"jobs\.ashbyhq\.com", re.I),
    re.compile(r"recruitee\.com", re.I),
    re.compile(r"jazz\.co", re.I),
]


async def detect_from_page(page, url: str, email: Optional[str]) -> str:
    """
    Determine apply method by reading the actual vacancy page.
    Returns string for backward compatibility.
    """
    result = await detect_from_page_conf(page, url, email)
    return result.value or "direct"


async def detect_from_page_conf(page, url: str, email: Optional[str]) -> FieldResult:
    """
    Determine apply method with confidence by reading the actual vacancy page.

    Enhanced analysis:
      1. Read description text for explicit instructions
      2. Inspect all apply buttons — check href targets
      3. Check for ATS-specific URL patterns in links
      4. Detect inline forms
      5. Look for LinkedIn Easy Apply indicators
    """
    try:
        page_data = await page.evaluate("""
            (pageUrl) => {
                const currentDomain = new URL(pageUrl).hostname;
                const out = {
                    descriptionText: '',
                    applyButtonMailto: null,
                    applyButtonExternal: null,
                    applyButtonExternalHref: null,
                    hasInlineForm: false,
                    hasEasyApply: false,
                    allApplyHrefs: [],
                    allMailtoEmails: [],
                };

                // ── 1. Grab vacancy description text ──
                const descSelectors = [
                    '#content_block .content-text',
                    '.vacancy .content-text',
                    '.job-description',
                    '.jobs-description__content',
                    '.show-more-less-html__markup',
                    '.jobsearch-JobComponent-description',
                    '[class*="description"]',
                    '.vacancy',
                ];
                for (const sel of descSelectors) {
                    const el = document.querySelector(sel);
                    if (el && el.innerText && el.innerText.trim().length > 50) {
                        out.descriptionText = el.innerText.trim().slice(0, 5000);
                        break;
                    }
                }

                // ── 2. Find all apply-related buttons/links ──
                const btnSelectors = [
                    '#apply-button a', '#apply-button button',
                    '.vacancy__apply a', '.vacancy__apply button',
                    '.apply-btn', '.apply-button',
                    'a[class*="apply"]', 'button[class*="apply"]',
                    'a[href*="apply"]', 'a[href*="application"]',
                    'a[href^="mailto:"]',
                    '.jobs-apply-button', 'button[aria-label*="Apply"]',
                    '[data-control-name="jobdetails_topcard_inapply"]',
                ];

                for (const sel of btnSelectors) {
                    try {
                        const els = document.querySelectorAll(sel);
                        for (const el of els) {
                            const style = window.getComputedStyle(el);
                            if (style.display === 'none' || style.visibility === 'hidden') continue;
                            if (el.offsetParent === null && style.position !== 'fixed') continue;

                            const href = el.getAttribute('href') || '';
                            if (!href) continue;

                            if (href.startsWith('mailto:')) {
                                const mailEmail = href.replace('mailto:', '').split('?')[0].trim();
                                out.applyButtonMailto = mailEmail;
                                out.allMailtoEmails.push(mailEmail);
                            } else if (href.startsWith('http')) {
                                try {
                                    const linkDomain = new URL(href).hostname;
                                    if (linkDomain !== currentDomain) {
                                        out.applyButtonExternal = href;
                                        out.applyButtonExternalHref = href;
                                    }
                                } catch {}
                            }
                            out.allApplyHrefs.push(href);
                        }
                    } catch {}
                }

                // ── 3. LinkedIn Easy Apply detection ──
                const easyApplyBtn = document.querySelector(
                    '.jobs-apply-button, button[aria-label*="Easy Apply"], ' +
                    '.jobs-s-apply button, [data-control-name="jobdetails_topcard_inapply"]'
                );
                if (easyApplyBtn) {
                    const btnText = (easyApplyBtn.textContent || '').toLowerCase();
                    if (btnText.includes('easy apply') || btnText.includes('easyapply')) {
                        out.hasEasyApply = true;
                    }
                }

                // ── 4. Check for inline apply form ──
                const formSels = [
                    'form[action*="apply"]', 'form[class*="apply"]',
                    '.application-form', '#application-form',
                    'form[action*="submit"]',
                ];
                for (const sel of formSels) {
                    if (document.querySelector(sel)) {
                        out.hasInlineForm = true;
                        break;
                    }
                }

                // ── 5. Check all links for ATS patterns ──
                const allLinks = document.querySelectorAll('a[href], iframe[src]');
                allLinks.forEach(el => {
                    const h = el.getAttribute('href') || el.getAttribute('src') || '';
                    if (h && h.startsWith('http')) out.allApplyHrefs.push(h);
                });

                return out;
            }
        """, url)

    except Exception as e:
        print(f"[ApplyDetect] Page analysis error: {e}")
        return FieldResult(value="direct", confidence=0.20, method="default",
                           evidence=f"Page analysis failed: {e}")

    if not page_data:
        return FieldResult(value="direct", confidence=0.20, method="default",
                           evidence="No page data")

    # ── Evaluate signals (ordered by confidence) ──

    # 1. LinkedIn Easy Apply (very high confidence)
    if page_data.get("hasEasyApply"):
        return FieldResult(value="easy_apply", confidence=0.95, method="rule",
                           evidence="LinkedIn Easy Apply button detected on page")

    # 2. Apply button is mailto (very high confidence)
    if page_data.get("applyButtonMailto"):
        mailto_email = page_data["applyButtonMailto"]
        return FieldResult(value="email", confidence=0.95, method="rule",
                           evidence=f"mailto: apply button → {mailto_email}")

    desc = page_data.get("descriptionText", "")

    # 3. Description explicitly says to email CV/resume + we have an email
    if desc and _EMAIL_APPLY_PATTERNS.search(desc):
        if email:
            return FieldResult(value="email", confidence=0.85, method="regex",
                               evidence="Description says to email CV + HR email found")
        # Description says email but we don't have the email yet
        if page_data.get("allMailtoEmails"):
            return FieldResult(value="email", confidence=0.80, method="regex",
                               evidence=f"Description says email + mailto found: {page_data['allMailtoEmails'][0]}")

    # 4. Apply button links to known ATS (high confidence)
    external_href = page_data.get("applyButtonExternalHref", "")
    if external_href:
        for ats_pattern in _ATS_EXTERNAL_PATTERNS:
            if ats_pattern.search(external_href):
                return FieldResult(value="external", confidence=0.90, method="rule",
                                   evidence=f"Apply button → ATS: {external_href[:80]}")

    # 5. Apply button links to external domain (moderate confidence)
    if page_data.get("applyButtonExternal"):
        return FieldResult(value="external", confidence=0.75, method="rule",
                           evidence=f"Apply button → external: {page_data['applyButtonExternal'][:80]}")

    # 6. Check all page links for ATS patterns
    for href in (page_data.get("allApplyHrefs") or [])[:50]:
        if not href.startswith("http"):
            continue
        for ats_pattern in _ATS_EXTERNAL_PATTERNS:
            if ats_pattern.search(href):
                return FieldResult(value="external", confidence=0.70, method="rule",
                                   evidence=f"ATS link found: {href[:80]}")

    # 7. Description mentions external application
    if desc and _EXTERNAL_APPLY_PATTERNS.search(desc):
        return FieldResult(value="external", confidence=0.60, method="regex",
                           evidence="Description mentions external application portal")

    # 8. Has an inline apply form
    if page_data.get("hasInlineForm"):
        return FieldResult(value="direct", confidence=0.70, method="rule",
                           evidence="Inline apply form detected")

    # 9. Default: unknown
    return FieldResult(value="direct", confidence=0.30, method="default",
                       evidence="No strong apply method signals detected on page")
