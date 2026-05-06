"""ZipRecruiter scraper — public job search.

Best-effort: ZipRecruiter uses Cloudflare and aggressive bot protection.
Returns [] on any failure rather than raising.
"""

from typing import Optional
from urllib.parse import quote_plus

from playwright_stealth import Stealth
from scraper import get_browser
from models.schemas import JobListing, JobSource, LocationFilter
from scraper._common import (
    basic_text_match,
    date_posted_cutoff,
    normalize_query,
    parse_iso_date,
    relative_to_iso,
    resolve_location_label,
)
from utils.job_meta_extractor import extract_all as extract_meta
from utils.job_meta_extractor import primary_experience_value


ZIP_BASE = "https://www.ziprecruiter.com"


async def scrape_ziprecruiter(
    query: str,
    location: Optional[LocationFilter] = None,
    work_modes: Optional[list[str]] = None,
    experience: Optional[list[str]] = None,
    job_types: Optional[list[str]] = None,
    date_posted: Optional[str] = None,
    sort_by: Optional[str] = None,
) -> list[JobListing]:
    from services.admin_log_service import log_scraper_start, log_scraper_done, log_scraper_error, log_captcha, log_bot_blocked, log_cloudflare, log_timeout
    log_scraper_start("ziprecruiter", query)
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
            viewport={"width": 1280, "height": 800},
        )
        await context.route(
            "**/*.{png,jpg,jpeg,gif,webp,woff,woff2,ttf,otf}",
            lambda route: route.abort(),
        )
        page = await context.new_page()
        await Stealth().apply_stealth_async(page)

        q = normalize_query(query)
        loc_label = resolve_location_label(location) or "United States"

        params = [f"search={quote_plus(q)}", f"location={quote_plus(loc_label)}"]

        # Date posted: days=1|3|5|10
        if date_posted in ("1d", "today", "past-24h"):
            params.append("days=1")
        elif date_posted == "3d":
            params.append("days=3")
        elif date_posted in ("7d", "past-week"):
            params.append("days=5")
        elif date_posted in ("1m", "past-month"):
            params.append("days=10")

        # Work modes — ZipRecruiter uses refine_by_location_type=remote
        if work_modes and "remote" in [w.lower() for w in work_modes]:
            params.append("refine_by_location_type=only_remote")

        # Job type filter — ZipRecruiter uses refine_by_employment=employment_type%3Aall+employment_type%3Afull_time, etc
        if job_types:
            jt_codes = []
            for jt in job_types:
                j = jt.lower()
                if j == "full-time":
                    jt_codes.append("employment_type:employment_type:full_time")
                elif j == "part-time":
                    jt_codes.append("employment_type:employment_type:part_time")
                elif j == "contract":
                    jt_codes.append("employment_type:employment_type:contract")
                elif j == "internship":
                    jt_codes.append("employment_type:employment_type:internship")
            if jt_codes:
                params.append(f"refine_by_employment={quote_plus('+'.join(jt_codes))}")

        url = f"{ZIP_BASE}/jobs-search?{'&'.join(params)}"

        captured_jobs: list[dict] = []

        async def _capture(response):
            try:
                if response.status != 200:
                    return
                ct = response.headers.get("content-type", "")
                if "json" not in ct:
                    return
                data = await response.json()
                if not isinstance(data, dict):
                    return
                for key in ("jobs", "data", "results", "hits", "jobResults"):
                    val = data.get(key)
                    if isinstance(val, list) and val and isinstance(val[0], dict):
                        if any(k in val[0] for k in ("title", "name", "position")):
                            captured_jobs.extend(val)
                            break
            except Exception:
                pass

        page.on("response", _capture)

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=25000)
            await page.wait_for_timeout(5000)
        except Exception:
            log_scraper_done("ziprecruiter", query, 0)
            return []

        # Cloudflare check
        page_title = await page.title()
        if any(kw in page_title.lower() for kw in ("just a moment", "cloudflare", "checking")):
            log_scraper_done("ziprecruiter", query, 0)
            return []

        cutoff = date_posted_cutoff(date_posted)
        results: list[JobListing] = []
        seen: set[str] = set()

        if captured_jobs:
            for item in captured_jobs:
                try:
                    title = (item.get("title") or item.get("name") or item.get("position") or "").strip()
                    if not title:
                        continue
                    job_id = item.get("id") or item.get("jobId") or ""
                    job_url = (
                        item.get("url") or item.get("applyUrl") or item.get("jobUrl") or
                        (f"{ZIP_BASE}/jobs/{job_id}" if job_id else "")
                    )
                    if not job_url or job_url in seen:
                        continue
                    if not job_url.startswith("http"):
                        job_url = f"{ZIP_BASE}{job_url}"
                    seen.add(job_url)

                    company = (item.get("hiring_company") or item.get("company") or item.get("employer") or "N/A")
                    if isinstance(company, dict):
                        company = company.get("name") or "N/A"
                    company = str(company).strip()

                    location_str = (item.get("location") or item.get("city") or "").strip()

                    date_raw = item.get("posted_time") or item.get("datePosted") or item.get("postedDate") or ""
                    date_iso = parse_iso_date(date_raw)
                    if not date_iso and date_raw:
                        iso_str = relative_to_iso(date_raw)
                        if iso_str:
                            date_iso = parse_iso_date(iso_str)
                    if cutoff and date_iso and date_iso < cutoff:
                        continue

                    lc = str(item).lower()
                    work_mode_str = None
                    if "remote" in lc:
                        work_mode_str = "Remote"
                    elif "hybrid" in lc:
                        work_mode_str = "Hybrid"

                    salary_text = item.get("salary_interval") or item.get("salary") or ""
                    if isinstance(salary_text, dict):
                        salary_text = ""
                    salary_text = str(salary_text).strip() if salary_text else ""

                    combined_text = f"{title} {company} {location_str}"
                    if not basic_text_match(q, title, company, combined_text):
                        continue

                    meta = extract_meta(combined_text)
                    logo_url = item.get("hiring_company", {}).get("logo") if isinstance(item.get("hiring_company"), dict) else None

                    results.append(
                        JobListing(
                            title=title,
                            company=company,
                            url=job_url,
                            date_posted=(date_iso.isoformat() if date_iso else date_raw),
                            source=JobSource.ziprecruiter,
                            logo_url=logo_url,
                            location_str=location_str,
                            description_snippet=None,
                            salary_str=salary_text or meta.get("salary_str"),
                            salary_src="structured" if salary_text else ("regex" if meta.get("salary_str") else None),
                            work_mode_str=work_mode_str,
                            work_mode_src="rule" if work_mode_str else None,
                            job_type_str=meta.get("job_type_str"),
                            job_type_src="rule" if meta.get("job_type_str") else None,
                            seniority_str=meta.get("seniority_str"),
                            seniority_src="rule" if meta.get("seniority_str") else None,
                            experience_str=primary_experience_value(meta.get("seniority_str"), meta.get("experience_years_str")),
                            experience_src="rule" if meta.get("seniority_str") or meta.get("experience_years_str") else None,
                        )
                    )
                except Exception:
                    continue

        if not results:
            # DOM fallback — single JS eval (fast, no per-element round-trips)
            try:
                dom_cards = await page.evaluate("""() => {
                    const cards = Array.from(document.querySelectorAll(
                        'article.job_result, li[class*="job"], div[class*="job_card"]'
                    ));
                    if (!cards.length) {
                        // Fallback: look for any link containing /jobs/
                        return Array.from(document.querySelectorAll('a[href*="/jobs/"]'))
                            .filter(a => a.pathname.split('/').filter(Boolean).length >= 2)
                            .slice(0, 50)
                            .map(a => ({
                                href: a.href,
                                title: a.innerText.trim().split('\\n')[0],
                                company: 'N/A',
                                location: '',
                                fullText: (a.closest('li, article') || a.parentElement || a).innerText.trim().substring(0, 800),
                                logoUrl: null,
                                salaryText: '',
                            }));
                    }
                    return cards.slice(0, 50).map(card => {
                        const link = card.querySelector('a[href*="/jobs/"], a.job_link');
                        const titleEl = card.querySelector('h2, h3, [class*="job_title"]');
                        const companyEl = card.querySelector('a.t_org_link, [class*="hiring_company"] a, [class*="company"]');
                        const locEl = card.querySelector('.location, [class*="location"]');
                        const salEl = card.querySelector('.compensation, [class*="salary"]');
                        const img = card.querySelector('img');
                        const dateEl = card.querySelector('time, [class*="posted"]');
                        return {
                            href: link ? link.href : '',
                            title: (titleEl || link || card).innerText.trim().split('\\n')[0],
                            company: companyEl ? companyEl.innerText.trim() : 'N/A',
                            location: locEl ? locEl.innerText.trim() : '',
                            fullText: card.innerText.trim().substring(0, 800),
                            logoUrl: img ? img.src : null,
                            salaryText: salEl ? salEl.innerText.trim() : '',
                            dateStr: dateEl ? (dateEl.getAttribute('datetime') || dateEl.innerText.trim()) : '',
                        };
                    });
                }""")
            except Exception:
                dom_cards = []

            for card in (dom_cards or []):
                try:
                    href = card.get("href") or ""
                    if not href:
                        continue
                    full_url = href if href.startswith("http") else f"{ZIP_BASE}{href}"
                    if full_url in seen:
                        continue
                    seen.add(full_url)

                    title = (card.get("title") or "").strip()
                    if not title:
                        continue

                    company = (card.get("company") or "N/A").strip()
                    location_str = (card.get("location") or "").strip()
                    full_text = (card.get("fullText") or "").strip()
                    salary_text = (card.get("salaryText") or "").strip()
                    logo_url = card.get("logoUrl") or None

                    if not basic_text_match(q, title, company, full_text):
                        continue

                    date_raw = card.get("dateStr") or ""
                    date_iso = parse_iso_date(date_raw)
                    if not date_iso and date_raw:
                        iso_str = relative_to_iso(date_raw)
                        if iso_str:
                            date_iso = parse_iso_date(iso_str)
                    if cutoff and date_iso and date_iso < cutoff:
                        continue

                    lc = full_text.lower()
                    work_mode_str = None
                    if "remote" in lc:
                        work_mode_str = "Remote"
                    elif "hybrid" in lc:
                        work_mode_str = "Hybrid"

                    meta = extract_meta(full_text or title)

                    results.append(
                        JobListing(
                            title=title,
                            company=company,
                            url=full_url,
                            date_posted=(date_iso.isoformat() if date_iso else date_raw),
                            source=JobSource.ziprecruiter,
                            logo_url=logo_url,
                            location_str=location_str,
                            description_snippet=(full_text[:1500] if full_text else None),
                            salary_str=salary_text or meta.get("salary_str"),
                            salary_src="structured" if salary_text else ("regex" if meta.get("salary_str") else None),
                            work_mode_str=work_mode_str,
                            work_mode_src="rule" if work_mode_str else None,
                            job_type_str=meta.get("job_type_str"),
                            job_type_src="rule" if meta.get("job_type_str") else None,
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

        log_scraper_done("ziprecruiter", query, len(results))
        return results
    except Exception as e:
        log_scraper_error("ziprecruiter", query, str(e))
        return []
    finally:
        try:
            if context:
                await context.close()
        except Exception:
            pass
