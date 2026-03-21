"""
Detect how a vacancy requires applying — from the actual page content.

Analyses:
  1. The vacancy description text (mentions email, external link, etc.)
  2. What the visible apply button/link points to (mailto, external domain, inline form)

Returns one of: "email" | "easy_apply" | "external" | "direct"
"""
import re
from typing import Optional


# Patterns in description text that indicate "send CV to this email"
_EMAIL_APPLY_PATTERNS = re.compile(
    r"(?:send|submit|email|forward|attach).{0,40}(?:cv|resume|application)|"
    r"(?:cv|resume|application).{0,40}(?:send|submit|email|forward)|"
    r"göndər.{0,30}(?:cv|resume)|"           # Azerbaijani
    r"müraciət.{0,20}e-?mail|"
    r"apply\s+(?:via|by|through)\s+e?-?mail",
    re.IGNORECASE,
)

# Patterns that indicate "apply on external site / company website"
_EXTERNAL_APPLY_PATTERNS = re.compile(
    r"apply\s+(?:on|at|through|via)\s+(?:our|the|company)\s+(?:website|site|portal|page)|"
    r"apply\s+(?:here|directly)\s+(?:on|at)|"
    r"click\s+(?:here|the\s+link)\s+to\s+apply|"
    r"visit\s+.{0,30}to\s+apply|"
    r"application\s+(?:link|url|portal)|"
    r"müraciət\s+linki",                      # Azerbaijani
    re.IGNORECASE,
)


def detect_from_jobsearch_item(item: dict, hr_email: Optional[str]) -> str:
    """Detect apply method from a jobsearch.az API item at search time."""
    if hr_email:
        return "email"
    return "direct"


def detect_from_linkedin_card(card_data: dict) -> str:
    """Detect apply method from a LinkedIn search card."""
    if card_data.get("has_easy_apply_badge"):
        return "easy_apply"
    return "external"


def detect_from_indeed_card(card_data: dict) -> str:
    """Detect apply method from an Indeed search card."""
    if card_data.get("has_easily_apply") or card_data.get("has_indeed_apply"):
        return "easy_apply"
    return "external"


async def detect_from_page(page, url: str, email: Optional[str]) -> str:
    """
    Determine apply method by reading the actual vacancy page.

    1. Read the vacancy description for explicit instructions
       ("send CV to ...", "apply on our website", etc.)
    2. Inspect the primary apply button — where does its href go?
       - mailto:  → "email"
       - different domain  → "external"
       - same domain form / no href  → "direct"
    3. If nothing found, "direct" as neutral default.
    """
    try:
        page_data = await page.evaluate("""
            (pageUrl) => {
                const currentDomain = new URL(pageUrl).hostname;
                const out = {
                    descriptionText: '',
                    applyButtonMailto: null,
                    applyButtonExternal: null,
                    hasInlineForm: false,
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

                // ── 2. Find visible apply button and check its href ──
                const btnSelectors = [
                    '#apply-button a', '#apply-button button',
                    '.vacancy__apply a', '.vacancy__apply button',
                    '.apply-btn', '.apply-button',
                    'a[class*="apply"]', 'button[class*="apply"]',
                    'a[href*="apply"]',
                    'a[href^="mailto:"]',
                ];

                for (const sel of btnSelectors) {
                    try {
                        const els = document.querySelectorAll(sel);
                        for (const el of els) {
                            // Only visible elements
                            const style = window.getComputedStyle(el);
                            if (style.display === 'none' || style.visibility === 'hidden') continue;
                            if (el.offsetParent === null && style.position !== 'fixed') continue;

                            const href = el.getAttribute('href') || '';
                            if (!href) continue;

                            if (href.startsWith('mailto:')) {
                                out.applyButtonMailto = href.replace('mailto:', '').split('?')[0].trim();
                                return out;  // strong signal, return immediately
                            }

                            if (href.startsWith('http')) {
                                try {
                                    const linkDomain = new URL(href).hostname;
                                    if (linkDomain !== currentDomain) {
                                        out.applyButtonExternal = href;
                                        // don't return — keep looking for mailto which is stronger
                                    }
                                } catch {}
                            }
                        }
                    } catch {}
                }

                // ── 3. Check for inline apply form ──
                const formSels = [
                    'form[action*="apply"]', 'form[class*="apply"]',
                    '.application-form', '#application-form',
                ];
                for (const sel of formSels) {
                    if (document.querySelector(sel)) {
                        out.hasInlineForm = true;
                        break;
                    }
                }

                return out;
            }
        """, url)

    except Exception as e:
        print(f"[ApplyDetect] Page analysis error: {e}")
        return "direct"

    if not page_data:
        return "direct"

    # ── Evaluate signals ──

    # Apply button is mailto → email
    if page_data.get("applyButtonMailto"):
        return "email"

    desc = page_data.get("descriptionText", "")

    # Description explicitly says to email CV/resume
    if desc and _EMAIL_APPLY_PATTERNS.search(desc):
        # Only if we actually have an email to send to
        if email:
            return "email"

    # Apply button links to external domain → external
    if page_data.get("applyButtonExternal"):
        return "external"

    # Description says to apply on external site
    if desc and _EXTERNAL_APPLY_PATTERNS.search(desc):
        return "external"

    # Has an inline apply form on the page → direct
    if page_data.get("hasInlineForm"):
        return "direct"

    return "direct"
