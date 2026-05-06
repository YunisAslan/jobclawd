"""Remote.co scraper — Playwright + single-pass JS evaluation."""

from typing import Optional
from urllib.parse import quote_plus

from playwright_stealth import Stealth
from scraper import get_browser
from models.schemas import JobListing, JobSource, LocationFilter
from scraper._common import (
    basic_text_match,
    date_posted_cutoff,
    location_includes_remote,
    normalize_query,
    parse_iso_date,
    relative_to_iso,
)
from utils.job_meta_extractor import extract_all as extract_meta
from utils.job_meta_extractor import primary_experience_value


REMOTECO_BASE = "https://remote.co"


async def scrape_remoteco(
    query: str,
    location: Optional[LocationFilter] = None,
    work_modes: Optional[list[str]] = None,
    experience: Optional[list[str]] = None,
    job_types: Optional[list[str]] = None,
    date_posted: Optional[str] = None,
    sort_by: Optional[str] = None,
) -> list[JobListing]:
    if not location_includes_remote(location):
        return []
    if work_modes and "remote" not in [w.lower() for w in work_modes]:
        return []

    from services.admin_log_service import log_scraper_start, log_scraper_done, log_scraper_error
    log_scraper_start("remoteco", query)
    context = None
    try:
        browser = await get_browser()
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
            locale="en-US",
            viewport={"width": 1280, "height": 720},
        )
        await context.route(
            "**/*.{png,jpg,jpeg,gif,webp,woff,woff2,ttf,otf}",
            lambda route: route.abort(),
        )
        page = await context.new_page()
        await Stealth().apply_stealth_async(page)

        q = normalize_query(query)
        url = f"{REMOTECO_BASE}/remote-jobs/search/?search_keywords={quote_plus(q)}"

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=25000)
            await page.wait_for_timeout(4000)
        except Exception:
            log_scraper_done("remoteco", query, 0)
            return []

        # CF detection
        page_title = (await page.title()).lower()
        if any(kw in page_title for kw in ("just a moment", "cloudflare", "checking")):
            log_scraper_done("remoteco", query, 0)
            return []

        # Single JS evaluation — no per-element round-trips
        try:
            cards = await page.evaluate("""() => {
                const links = Array.from(document.querySelectorAll('a[href*="/remote-jobs/"]'));
                return links
                    .filter(a => {
                        const parts = a.pathname.split('/').filter(Boolean);
                        // Need at least 2 path segments after hostname: remote-jobs + slug
                        if (parts.length < 2) return false;
                        if (a.pathname === '/remote-jobs' || a.pathname === '/remote-jobs/') return false;
                        if (a.search.includes('page=')) return false;
                        return true;
                    })
                    .slice(0, 60)
                    .map(a => {
                        const block = a.closest('li, article, .job_listing') || a.parentElement || a;
                        const timeEl = block.querySelector('time, [class*="date"], [class*="posted"]');
                        const imgEl = block.querySelector('img');
                        return {
                            href: a.href,
                            linkText: a.innerText.trim().split('\\n')[0],
                            cardText: block.innerText.trim().substring(0, 600),
                            dateStr: timeEl ? (timeEl.getAttribute('datetime') || timeEl.innerText.trim()) : '',
                            logoUrl: imgEl ? imgEl.src : null,
                        };
                    });
            }""")
        except Exception:
            cards = []

        cutoff = date_posted_cutoff(date_posted)
        results: list[JobListing] = []
        seen: set[str] = set()

        for card in (cards or []):
            try:
                href = card.get("href") or ""
                if not href or href in seen:
                    continue
                seen.add(href)

                title = (card.get("linkText") or "").strip()
                if not title or len(title) > 200:
                    continue

                card_text = (card.get("cardText") or "").strip()
                lines = [l.strip() for l in card_text.splitlines() if l.strip()]
                company = "N/A"
                for line in lines[1:]:
                    if line and line != title and len(line) < 80:
                        company = line
                        break

                if not basic_text_match(q, title, company, card_text):
                    continue

                date_raw = card.get("dateStr") or ""
                date_iso = parse_iso_date(date_raw)
                if not date_iso and date_raw:
                    iso_str = relative_to_iso(date_raw)
                    if iso_str:
                        date_iso = parse_iso_date(iso_str)
                if cutoff and date_iso and date_iso < cutoff:
                    continue

                logo_url = card.get("logoUrl") or None
                if logo_url and logo_url.startswith("//"):
                    logo_url = "https:" + logo_url

                meta = extract_meta(card_text or title)

                results.append(JobListing(
                    title=title,
                    company=company,
                    url=href,
                    date_posted=(date_iso.isoformat() if date_iso else date_raw),
                    source=JobSource.remoteco,
                    logo_url=logo_url,
                    location_str="Remote",
                    description_snippet=(card_text[:1500] if card_text else None),
                    salary_str=meta.get("salary_str"),
                    salary_src="regex" if meta.get("salary_str") else None,
                    work_mode_str="Remote",
                    work_mode_src="structured",
                    job_type_str=meta.get("job_type_str") or "Full-time",
                    job_type_src="rule" if meta.get("job_type_str") else "default",
                    seniority_str=meta.get("seniority_str"),
                    seniority_src="rule" if meta.get("seniority_str") else None,
                    experience_str=primary_experience_value(meta.get("seniority_str"), meta.get("experience_years_str")),
                    experience_src="rule" if meta.get("seniority_str") or meta.get("experience_years_str") else None,
                ))
            except Exception:
                continue

        if sort_by == "job-title-ascending":
            results.sort(key=lambda j: j.title.lower())
        elif sort_by == "job-title-descending":
            results.sort(key=lambda j: j.title.lower(), reverse=True)
        else:
            results.sort(key=lambda j: j.date_posted, reverse=True)

        log_scraper_done("remoteco", query, len(results))
        return results

    except Exception as e:
        log_scraper_error("remoteco", query, str(e))
        return []
    finally:
        try:
            if context:
                await context.close()
        except Exception:
            pass
