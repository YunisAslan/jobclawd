"""Simplify scraper — public job board at jobs.simplify.jobs."""

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
    resolve_location_label,
)
from utils.job_meta_extractor import extract_all as extract_meta
from utils.job_meta_extractor import primary_experience_value


SIMPLIFY_BASE = "https://jobs.simplify.jobs"


async def scrape_simplify(
    query: str,
    location: Optional[LocationFilter] = None,
    work_modes: Optional[list[str]] = None,
    experience: Optional[list[str]] = None,
    job_types: Optional[list[str]] = None,
    date_posted: Optional[str] = None,
    sort_by: Optional[str] = None,
) -> list[JobListing]:
    from services.admin_log_service import log_scraper_start, log_scraper_done, log_scraper_error, log_captcha, log_bot_blocked, log_cloudflare, log_timeout
    log_scraper_start("simplify", query)
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
        params = [f"query={quote_plus(q)}"] if q else []
        loc_label = resolve_location_label(location)
        if loc_label:
            params.append(f"location={quote_plus(loc_label)}")
        if work_modes and "remote" in [w.lower() for w in work_modes]:
            params.append("workplace=Remote")
        if experience:
            exp_codes = []
            for e in experience:
                el = e.lower()
                if "intern" in el:
                    exp_codes.append("Internship")
                if "junior" in el:
                    exp_codes.append("Entry")
                if "mid" in el:
                    exp_codes.append("Mid")
                if "senior" in el or "lead" in el:
                    exp_codes.append("Senior")
            if exp_codes:
                params.append(f"experience={quote_plus(','.join(set(exp_codes)))}")

        url = f"{SIMPLIFY_BASE}?{'&'.join(params)}" if params else SIMPLIFY_BASE
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=25000)
            await page.wait_for_selector(
                "a[href*='/jobs/'], [class*='JobCard'], [data-testid*='job']",
                timeout=10000,
            )
        except Exception:
            return []

        # Lazy-load
        for _ in range(3):
            try:
                await page.evaluate("window.scrollBy(0, window.innerHeight)")
                await page.wait_for_timeout(400)
            except Exception:
                break

        cards = await page.query_selector_all(
            "a[href*='/jobs/'], [class*='JobCard'], [data-testid*='job-card']"
        )
        cutoff = date_posted_cutoff(date_posted)
        results: list[JobListing] = []
        seen: set[str] = set()

        for card in cards:
            try:
                tag = (await card.evaluate("el => el.tagName")) or ""
                href = None
                if tag == "A":
                    href = await card.get_attribute("href")
                else:
                    a = await card.query_selector("a[href*='/jobs/']")
                    if a:
                        href = await a.get_attribute("href")
                if not href:
                    continue
                full_url = href if href.startswith("http") else f"{SIMPLIFY_BASE}{href}"
                if full_url in seen:
                    continue
                seen.add(full_url)

                full_text = ""
                try:
                    full_text = (await card.inner_text()).strip()
                except Exception:
                    pass
                lines = [l.strip() for l in full_text.splitlines() if l.strip()]
                if not lines:
                    continue
                title = lines[0]
                company = lines[1] if len(lines) > 1 else "N/A"

                if not basic_text_match(q, title, company, full_text):
                    continue

                date_iso_str = relative_to_iso(full_text) or ""
                date_iso = parse_iso_date(date_iso_str) if date_iso_str else None
                if cutoff and date_iso and date_iso < cutoff:
                    continue

                lc = full_text.lower()
                work_mode_str = None
                if "remote" in lc:
                    work_mode_str = "Remote"
                elif "hybrid" in lc:
                    work_mode_str = "Hybrid"
                elif "on-site" in lc or "onsite" in lc:
                    work_mode_str = "On-site"

                logo_el = await card.query_selector("img")
                logo_url = await logo_el.get_attribute("src") if logo_el else None

                location_str = ""
                for line in lines[2:5]:
                    if any(tok in line.lower() for tok in ("remote", "hybrid", ",", "usa", "us")):
                        location_str = line
                        break

                meta = extract_meta(full_text or title)

                results.append(
                    JobListing(
                        title=title,
                        company=company,
                        url=full_url,
                        date_posted=(date_iso.isoformat() if date_iso else ""),
                        source=JobSource.simplify,
                        logo_url=logo_url,
                        location_str=location_str or (loc_label or ""),
                        description_snippet=(full_text[:1500] if full_text else None),
                        salary_str=meta.get("salary_str"),
                        salary_src="regex" if meta.get("salary_str") else None,
                        work_mode_str=work_mode_str,
                        work_mode_src="rule" if work_mode_str else None,
                        job_type_str=meta.get("job_type_str") or "Full-time",
                        job_type_src="rule" if meta.get("job_type_str") else "default",
                        seniority_str=meta.get("seniority_str"),
                        seniority_src="rule" if meta.get("seniority_str") else None,
                        experience_str=primary_experience_value(meta.get("seniority_str"), meta.get("experience_years_str")),
                        experience_src="rule" if meta.get("seniority_str") or meta.get("experience_years_str") else None,
                    )
                )
            except Exception:
                continue

        if sort_by == "job-title-ascending":
            results.sort(key=lambda j: j.title.lower())
        elif sort_by == "job-title-descending":
            results.sort(key=lambda j: j.title.lower(), reverse=True)
        else:
            results.sort(key=lambda j: j.date_posted, reverse=True)

        log_scraper_done("simplify", query, len(results))
        return results
    except Exception as e:
        log_scraper_error("simplify", query, str(e))
        return []
    finally:
        try:
            if context:
                await context.close()
        except Exception:
            pass
