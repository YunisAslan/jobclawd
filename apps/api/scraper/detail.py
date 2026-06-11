from typing import Optional
import asyncio
import html as _html
import json as _json
import re
from urllib.parse import urlsplit, urlunsplit

import httpx

from scraper import get_browser
from models.schemas import JobDetailResponse
from utils.email_extractor import extract_emails
from services.apply_link_resolver import resolve_apply_link

_BOT_SIGNALS = ("security service", "verifying you are not a bot", "enable javascript", "cf-browser-verification")

_HTTPX_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Cache-Control": "no-cache",
}


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


def _is_bot_blocked(html: str) -> bool:
    low = html.lower()
    return any(sig in low for sig in _BOT_SIGNALS)


def _unescape_html(text: str) -> str:
    """Decode HTML entities, twice — Jobicy double-encodes (e.g. '&amp;#8211;')."""
    return _html.unescape(_html.unescape(text or "")).strip()


def _jobicy_from_jsonld(html: str) -> Optional[dict]:
    """Parse the JobPosting JSON-LD block from a Jobicy job page."""
    for block in re.findall(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html,
        re.DOTALL,
    ):
        try:
            data = _json.loads(block.strip())
        except Exception:
            continue
        items = data if isinstance(data, list) else [data]
        for it in items:
            if not isinstance(it, dict) or "JobPosting" not in str(it.get("@type", "")):
                continue
            org = it.get("hiringOrganization") or {}
            company = org.get("name") if isinstance(org, dict) else None
            return {
                "title": _unescape_html(it.get("title") or ""),
                "company": _unescape_html(company or ""),
                "description": _collapse(_strip_tags(_unescape_html(it.get("description") or ""))),
            }
    return None


async def _jobicy_via_api(job_id: str, slug_parts: list[str]) -> Optional[dict]:
    """Fallback: find the job via the public API by tag search + ID match."""
    tag_words = [w for w in slug_parts if len(w) > 2][:4]
    if not tag_words:
        return None
    try:
        async with httpx.AsyncClient(
            timeout=15.0,
            headers={**_HTTPX_HEADERS, "Accept": "application/json"},
        ) as client:
            resp = await client.get(
                "https://jobicy.com/api/v2/remote-jobs",
                params={"count": 50, "tag": " ".join(tag_words)},
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return None

    jobs = data.get("jobs", []) if isinstance(data, dict) else []
    item = next(
        (j for j in jobs if str(j.get("id", "")) == job_id or
         str(j.get("jobSlug", "")).startswith(job_id + "-")),
        None,
    )
    if not item:
        return None
    raw_desc = item.get("jobDescription") or item.get("jobExcerpt") or ""
    return {
        "title": (item.get("jobTitle") or "").strip(),
        "company": (item.get("companyName") or "").strip(),
        "description": _collapse(_strip_tags(raw_desc)),
    }


async def _jobicy_detail(url: str) -> Optional[JobDetailResponse]:
    """Fetch a Jobicy job without Playwright (Cloudflare blocks the headless browser).

    Primary path: fetch the page HTML via httpx and parse the JobPosting JSON-LD
    block — works for any job regardless of age. Cloudflare serves the full page
    to plain httpx requests; only the headless browser gets challenged.

    Fallback: the public REST API, searched by slug keywords and matched by ID.
    """
    slug_part = url.rstrip("/").split("/")[-1]
    parts = slug_part.split("-")
    job_id = parts[0] if parts else ""
    if not job_id.isdigit():
        return None

    parsed: Optional[dict] = None
    try:
        async with httpx.AsyncClient(
            timeout=20.0, headers=_HTTPX_HEADERS, follow_redirects=True
        ) as client:
            resp = await client.get(url)
            if resp.status_code == 200 and not _is_bot_blocked(resp.text):
                parsed = _jobicy_from_jsonld(resp.text)
    except Exception:
        parsed = None

    if not parsed or not parsed.get("description"):
        parsed = await _jobicy_via_api(job_id, parts[1:])

    if not parsed or not parsed.get("description"):
        return None

    return JobDetailResponse(
        title=(parsed.get("title") or "N/A")[:200],
        company=(parsed.get("company") or "N/A")[:200],
        description=parsed["description"][:4000],
        email=None,
        email_found=False,
        apply_url=url,
        error_message="No email found — apply directly on the site.",
        resolved_apply_url=url,
        apply_url_confidence=0.9,
        apply_requires_login=False,
        fallback_urls=[],
    )


def _strip_tags(html: str) -> str:
    return re.sub(r"<[^>]+>", " ", html)


def _collapse(text: str) -> str:
    return re.sub(r"\s{2,}", " ", text).strip()


async def _wwr_detail(url: str) -> Optional[JobDetailResponse]:
    """Fetch a WeWorkRemotely job via httpx — avoids Playwright bot detection."""
    try:
        async with httpx.AsyncClient(timeout=20.0, headers=_HTTPX_HEADERS, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            html = resp.text
        if _is_bot_blocked(html):
            return None

        # Title — try OG tag first, then h1
        title = ""
        og_title = re.search(r'<meta[^>]+property="og:title"[^>]+content="([^"]+)"', html)
        if og_title:
            title = og_title.group(1).strip()
        if not title:
            h1 = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.DOTALL)
            title = _collapse(_strip_tags(h1.group(1))) if h1 else ""

        # Company — WWR puts it in <span class="company"> or similar
        company = ""
        for pat in (
            r'<span[^>]+class="[^"]*company[^"]*"[^>]*>(.*?)</span>',
            r'<h2[^>]+class="[^"]*company[^"]*"[^>]*>(.*?)</h2>',
        ):
            m = re.search(pat, html, re.DOTALL)
            if m:
                company = _collapse(_strip_tags(m.group(1)))
                break
        # Fall back: "Company: Title" pattern from OG description
        if not company:
            og_desc = re.search(r'<meta[^>]+property="og:description"[^>]+content="([^"]+)"', html)
            if og_desc and ": " in og_desc.group(1):
                company = og_desc.group(1).split(":")[0].strip()

        # Description — main listing container
        description = ""
        for pat in (
            r'<div[^>]+class="[^"]*listing-container[^"]*"[^>]*>(.*?)</div>\s*(?:</div>|<div[^>]+class="[^"]*apply)',
            r'<section[^>]+id="[^"]*job[^"]*"[^>]*>(.*?)</section>',
            r'<div[^>]+id="[^"]*listing[^"]*"[^>]*>(.*?)</div>',
        ):
            m = re.search(pat, html, re.DOTALL)
            if m:
                candidate = _collapse(_strip_tags(m.group(1)))
                if len(candidate) > 100:
                    description = candidate
                    break

        if not description or len(description) < 100:
            return None  # Not enough content — let Playwright try

        return JobDetailResponse(
            title=(title or "N/A")[:200],
            company=(company or "N/A")[:200],
            description=description[:4000],
            email=None,
            email_found=False,
            apply_url=url,
            error_message="No email found — apply directly on the site.",
            resolved_apply_url=url,
            apply_url_confidence=0.5,
            apply_requires_login=False,
            fallback_urls=[],
        )
    except Exception:
        return None


async def scrape_job_detail(url: str) -> JobDetailResponse:
    url = _normalize_detail_url(url)

    # Source-specific fast paths that avoid Playwright bot-detection issues
    if "jobicy.com" in url:
        result = await _jobicy_detail(url)
        if result:
            return result

    if "weworkremotely.com" in url:
        result = await _wwr_detail(url)
        if result:
            return result

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

        # Discard if Playwright got a bot-protection page
        if _is_bot_blocked(description) or _is_bot_blocked(title):
            description = ""
            title = "N/A"
            company = "N/A"

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
