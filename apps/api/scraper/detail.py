from typing import Optional
import asyncio
import json as _json
from urllib.parse import urlsplit, urlunsplit
from scraper import get_browser
from models.schemas import JobDetailResponse
from utils.email_extractor import extract_emails
from services.apply_link_resolver import resolve_apply_link


def _normalize_detail_url(url: str) -> str:
    raw = (url or "").strip()
    if not raw:
        return raw

    parts = urlsplit(raw)
    host = (parts.netloc or "").lower()
    if host.endswith(".linkedin.com") or host == "linkedin.com":
        host = "www.linkedin.com"

    return urlunsplit((
        parts.scheme or "https",
        host,
        parts.path,
        parts.query,
        parts.fragment,
    ))


def _email_from_api_item(item: dict) -> Optional[str]:
    """Extract email from a jobsearch.az API vacancy object."""
    for key in ("email", "contact_email", "hr_email"):
        v = item.get(key)
        if isinstance(v, str) and "@" in v:
            return v.strip()
    for section_key in ("contacts", "contact", "contact_person", "company"):
        section = item.get(section_key) or {}
        if isinstance(section, dict):
            for key in ("email", "contact_email"):
                v = section.get(key)
                if isinstance(v, str) and "@" in v:
                    return v.strip()
    raw = _json.dumps(item)
    found = extract_emails(raw)
    return found[0] if found else None


async def _click_apply_and_extract_email(page) -> Optional[str]:
    """Click every likely Apply button and extract the revealed email."""
    selectors = [
        "#apply-button a",
        "#apply-button button",
        "a.apply",
        "button.apply",
        "[data-target='#applyModal']",
        "[data-toggle='modal']",
        "button[class*='apply']",
        "a[class*='apply']",
        "button:has-text('Müraciət')",
        "a:has-text('Müraciət')",
        "button:has-text('Apply')",
        ".vacancy__apply a",
        ".vacancy__apply button",
        ".apply-btn",
    ]
    clicked = False
    for sel in selectors:
        try:
            el = page.locator(sel).first
            if await el.count() > 0:
                await el.click(timeout=3000)
                clicked = True
                break
        except Exception:
            continue

    if not clicked:
        return None

    for sel in (".apply__send-mail", ".apply-email", "#applyModal", ".modal.show", "a[href^='mailto:']"):
        try:
            await page.wait_for_selector(sel, timeout=4000)
            break
        except Exception:
            pass

    await page.wait_for_timeout(500)

    return await page.evaluate("""
        () => {
            const mailtos = document.querySelectorAll('a[href^="mailto:"]');
            for (const a of mailtos) {
                const e = a.href.replace('mailto:', '').split('?')[0].trim();
                if (e.includes('@')) return e;
            }
            const containers = document.querySelectorAll(
                '.apply__send-mail, .apply-email, .apply__email, ' +
                '[class*="send-mail"], [class*="apply-email"], ' +
                '#applyModal, .modal.show, .apply-block, .contact-block'
            );
            for (const el of containers) {
                const match = (el.textContent || '').match(
                    /[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}/
                );
                if (match) return match[0].trim();
            }
            return null;
        }
    """)


async def _extract_email_from_page(page) -> Optional[str]:
    try:
        mailto_emails = await page.evaluate("""
            () => Array.from(document.querySelectorAll('a[href^="mailto:"]'))
                  .map(a => a.href.replace('mailto:', '').split('?')[0].trim())
                  .filter(e => e.includes('@'))
        """)
        if mailto_emails:
            filtered = extract_emails(" ".join(mailto_emails))
            if filtered:
                return filtered[0]

        body_text = await page.evaluate("""
            () => {
                const clone = document.body.cloneNode(true);
                clone.querySelectorAll('script,style,noscript').forEach(e => e.remove());
                return clone.innerText || clone.textContent || '';
            }
        """)
        found = extract_emails(body_text)
        return found[0] if found else None
    except Exception:
        return None


async def scrape_job_detail(url: str) -> JobDetailResponse:
    url = _normalize_detail_url(url)
    browser = await get_browser()
    context = await browser.new_context(
        user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        viewport={"width": 1280, "height": 720},
    )
    page = await context.new_page()

    # Collect API data from any vacancy-related endpoint during page load
    api_email: list[Optional[str]] = [None]
    api_event = asyncio.Event()
    slug = url.rstrip("/").split("/")[-1] if "jobsearch.az" in url else None

    async def handle_response(response):
        if api_event.is_set():
            return
        try:
            resp_url = response.url
            if "/api-az/vacanc" not in resp_url:
                return
            data = await response.json()

            candidates = []
            if isinstance(data, dict):
                # Single vacancy object
                if data.get("slug") == slug or "slug" in data:
                    candidates.append(data)
                # Wrapped
                for key in ("data", "vacancy", "item"):
                    v = data.get(key)
                    if isinstance(v, dict):
                        candidates.append(v)
                # List inside response
                items = data.get("items") or data.get("data") or []
                if isinstance(items, list):
                    candidates.extend(items)

            for item in candidates:
                if not isinstance(item, dict):
                    continue
                if slug and item.get("slug") not in (slug, None):
                    continue
                e = _email_from_api_item(item)
                if e:
                    api_email[0] = e
                    api_event.set()
                    return
        except Exception:
            pass

    page.on("response", handle_response)

    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=25000)
        try:
            await page.wait_for_load_state("load", timeout=8000)
        except Exception:
            pass

        # Give a moment for async API calls that fire after DOMContentLoaded
        try:
            await asyncio.wait_for(api_event.wait(), timeout=5)
        except asyncio.TimeoutError:
            pass

        title = await page.evaluate("""
            () => {
                for (const s of ['.vacancy__title','h1.title','h1','.job-title','.position-title']) {
                    const el = document.querySelector(s);
                    if (el && el.textContent.trim()) return el.textContent.trim();
                }
                return document.title || '';
            }
        """)

        company = await page.evaluate("""
            () => {
                for (const s of ['.company__title','.vacancy__start','.employer-name','.company-name']) {
                    const el = document.querySelector(s);
                    if (el && el.textContent.trim()) return el.textContent.trim();
                }
                return '';
            }
        """)

        description = await page.evaluate("""
            () => {
                for (const s of [
                    '#content_block .content-text',
                    '.vacancy .content-text',
                    '.job-description',
                    '[class*="description"]',
                    '.vacancy'
                ]) {
                    const el = document.querySelector(s);
                    if (el && el.innerText && el.innerText.trim().length > 50)
                        return el.innerText.trim();
                }
                return '';
            }
        """)

        # 1. Email from API response (most reliable for jobsearch.az)
        email = api_email[0]

        # 2. Click Apply button to reveal email in modal (jobsearch.az specific)
        if not email and "jobsearch.az" in url:
            email = await _click_apply_and_extract_email(page)

        # 3. Check only mailto: links — NOT a full-page regex scan.
        #    Random emails in footers/contact sections are NOT apply emails.
        if not email:
            email = await page.evaluate("""
                () => {
                    const mailtos = document.querySelectorAll('a[href^="mailto:"]');
                    for (const a of mailtos) {
                        const e = a.href.replace('mailto:', '').split('?')[0].trim();
                        if (e.includes('@')) return e;
                    }
                    return null;
                }
            """)

        # Resolve the real apply destination URL.
        resolved = None
        try:
            resolved = await resolve_apply_link(
                page=page,
                url=url,
            )
        except Exception as e:
            print(f"[Detail] Apply link resolution error: {e}")

        return JobDetailResponse(
            title=(title or "N/A")[:200],
            company=(company or "N/A")[:200],
            description=(description or "")[:2000],
            email=email,
            email_found=email is not None,
            apply_url=url,
            error_message=(
                None if email else "No email found — apply directly on the site."
            ),
            resolved_apply_url=resolved.apply_url if resolved else None,
            apply_url_confidence=resolved.confidence if resolved else 0.0,
            apply_requires_login=resolved.requires_login if resolved else False,
            fallback_urls=resolved.fallback_urls if resolved else [],
        )

    finally:
        await context.close()
