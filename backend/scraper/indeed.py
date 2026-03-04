"""Indeed (az) job scraper — non-fatal, returns [] on any error."""

from urllib.parse import quote_plus
from typing import Optional
from scraper import get_browser
from models.schemas import JobListing, JobSource, LocationFilter
from db.database import get_db

INDEED_BASE = "https://www.indeed.com"


async def scrape_indeed(
    query: str, 
    location: Optional[LocationFilter] = None,
    work_modes: Optional[list[str]] = None,
    experience: Optional[list[str]] = None,
    job_types: Optional[list[str]] = None,
    date_posted: Optional[str] = None,
    sort_by: Optional[str] = None
) -> list[JobListing]:
    context = None
    try:
        browser = await get_browser()
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 720},
        )

        await context.route(
            "**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,otf}",
            lambda route: route.abort(),
        )

        page = await context.new_page()

        encoded_q = quote_plus(query)
        target_location = "Bakı" # Default for indeed.az
        
        if location and location.type in ["country", "city"]:
            val = None
            if location.values and len(location.values) > 0:
                val = location.values[0]
            elif location.value:
                val = location.value
                
            if val:
                if location.type == "country":
                    with get_db() as conn:
                        row = conn.execute("SELECT name FROM countries WHERE code = ?", (val,)).fetchone()
                        if row:
                            target_location = row["name"]
                elif location.type == "city":
                    with get_db() as conn:
                        row = conn.execute("SELECT name FROM cities WHERE value = ?", (val,)).fetchone()
                        if row:
                            target_location = row["name"]
                        else:
                            # Fallback if DB lookup fails, format az-baku as baku
                            target_location = val.split("-")[1].title() if "-" in val else val.title()

        encoded_l = quote_plus(target_location)
        
        # Determine from_age — 0 means "any time" (no restriction)
        fromage = 0
        if date_posted in ("1d", "today", "past-24h"):
            fromage = 1
        elif date_posted in ("3d",):
            fromage = 3
        elif date_posted in ("7d", "past-week"):
            fromage = 7
        elif date_posted in ("1m", "past-month"):
            fromage = 30
            
        # Determine sc parameters
        sc_tags = []
        if work_modes and "remote" in work_modes:
            sc_tags.append("attr(DSQF7)")
        
        if experience:
            if "junior" in experience or "freshmen" in experience:
                sc_tags.append("explvl(ENTRY_LEVEL)")
            elif "mid" in experience:
                sc_tags.append("explvl(MID_LEVEL)")
            elif "senior" in experience or "lead" in experience:
                sc_tags.append("explvl(SENIOR_LEVEL)")
                
        if job_types:
            if "full-time" in job_types:
                sc_tags.append("jobtype(fulltime)")
            elif "part-time" in job_types:
                sc_tags.append("jobtype(parttime)")
            elif "internship" in job_types:
                sc_tags.append("jobtype(internship)")
                
        sc_query = ""
        if sc_tags:
            sc_query = f"&sc=0kf:{''.join([f'{t};' for t in sc_tags])}"

        base_url = f"{INDEED_BASE}/jobs?q={encoded_q}&l={encoded_l}"
        if fromage > 0:
            base_url += f"&fromage={fromage}"
        base_url += sc_query
        
        # Always sort by date for freshness by default
        base_url += "&sort=date"

        jobs: list[JobListing] = []
        seen_jks = set()
        
        for offset in range(0, 200, 10):
            url = f"{base_url}&start={offset}"
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=25000)
                await page.wait_for_timeout(2000)
            except Exception:
                break
                
            cards = await page.query_selector_all(".job_seen_beacon")
            if not cards:
                cards = await page.query_selector_all(".result")
                
            if not cards:
                break

            for card in cards:
                try:
                    jk_el = await card.query_selector("[data-jk]")
                    jk = await jk_el.get_attribute("data-jk") if jk_el else None
                    if not jk or jk in seen_jks:
                        continue
                        
                    title_el = await card.query_selector('[data-testid="jobTitle"] span')
                    if not title_el:
                        title_el = await card.query_selector('h2.jobTitle span')
                        
                    company_el = await card.query_selector('[data-testid="company-name"]')
                    date_el = await card.query_selector('[data-testid="myJobsStateDate"]')
                    location_el = await card.query_selector('[data-testid="text-location"]')

                    title = ""
                    if title_el:
                        title = (await title_el.inner_text()).strip()
                        if not title:
                            title = await title_el.get_attribute("title")
                    else:
                        title_el = await card.query_selector('h2.jobTitle')
                        if title_el:
                            title = (await title_el.inner_text()).strip()

                    company = (await company_el.inner_text()).strip() if company_el else ""
                    date_str = (await date_el.inner_text()).strip() if date_el else ""
                    location_str = (await location_el.inner_text()).strip() if location_el else ""

                    if not title:
                        continue
                        
                    seen_jks.add(jk)

                    job_url = f"{INDEED_BASE}/viewjob?jk={jk}"
                    jobs.append(
                        JobListing(
                            title=title,
                            company=company,
                            url=job_url,
                            date_posted=date_str,
                            source=JobSource.indeed,
                            location_str=location_str,
                        )
                    )
                except Exception:
                    continue
                    
            if len(jobs) >= 200:
                break

        print(f"[Indeed] Fetched {len(jobs)} jobs for '{query}' @ {target_location}")
        return jobs

    except Exception:
        return []
    finally:
        try:
            if context:
                await context.close()
        except Exception:
            pass
