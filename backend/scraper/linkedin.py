"""LinkedIn job scraper — non-fatal, returns [] on any error."""

from urllib.parse import quote_plus
from typing import Optional
from scraper import get_browser
from models.schemas import JobListing, JobSource, LocationFilter
from db.database import get_db

async def scrape_linkedin(
    query: str, 
    location: Optional[LocationFilter] = None,
    work_modes: Optional[list[str]] = None,
    experience: Optional[list[str]] = None,
    job_types: Optional[list[str]] = None,
    date_posted: Optional[str] = None,
    sort_by: Optional[str] = None
) -> list[JobListing]:
    try:
        browser = await get_browser()
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            locale="az-AZ",
            viewport={"width": 1280, "height": 720},
        )

        # Block images and fonts to speed up
        await context.route(
            "**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,otf}",
            lambda route: route.abort(),
        )

        page = await context.new_page()

        encoded_query = quote_plus(query)
        target_location = "Worldwide"
        if location and location.type in ["country", "city"]:
            if location.type == "country":
                if location.values and len(location.values) == 1:
                    with get_db() as conn:
                        row = conn.execute("SELECT name FROM countries WHERE code = ?", (location.values[0],)).fetchone()
                        if row:
                            target_location = row["name"]
                elif location.value:
                    with get_db() as conn:
                        row = conn.execute("SELECT name FROM countries WHERE code = ?", (location.value,)).fetchone()
                        if row:
                            target_location = row["name"]
            elif location.type == "city" and location.value:
                with get_db() as conn:
                    row = conn.execute("SELECT name FROM cities WHERE value = ?", (location.value,)).fetchone()
                    if row:
                        target_location = row["name"]
                        
        encoded_location = quote_plus(target_location)
        
        base_url = f"https://www.linkedin.com/jobs/search/?keywords={encoded_query}&location={encoded_location}"
        
        # Native Work Mode Filter
        wt_flags = []
        if work_modes:
            if "remote" in work_modes: wt_flags.append("2")
            if "hybrid" in work_modes: wt_flags.append("3")
            if "onsite" in work_modes: wt_flags.append("1")
        if wt_flags:
            base_url += f"&f_WT={','.join(wt_flags)}"
            
        # Native Experience Filter
        e_flags = []
        if experience:
            if "junior" in experience: e_flags.append("2")
            if "mid" in experience: e_flags.append("3")
            if "senior" in experience or "lead" in experience: e_flags.append("4")
            if "freshmen" in experience: e_flags.append("1") # Internship context
        if e_flags:
            base_url += f"&f_E={','.join(e_flags)}"
            
        # Native Job Type Filter
        jt_flags = []
        if job_types:
            if "full-time" in job_types: jt_flags.append("F")
            if "part-time" in job_types: jt_flags.append("P")
            if "contract" in job_types: jt_flags.append("C")
            if "internship" in job_types: 
                jt_flags.append("I")
                if "1" not in e_flags:
                    base_url += "&f_E=1"
        if jt_flags:
            base_url += f"&f_JT={','.join(jt_flags)}"
        
        if date_posted == "today" or date_posted == "past-24h":
            base_url += "&f_TPR=r86400"
        elif date_posted == "past-week":
            base_url += "&f_TPR=r604800"
        elif date_posted == "past-month":
            base_url += "&f_TPR=r2592000"
            
        if sort_by == "relevance":
            base_url += "&sortBy=R"
        else:
            base_url += "&sortBy=DD" # default to chronological

        url = base_url

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=25000)
            await page.wait_for_timeout(3000)
        except Exception:
            return []

        jobs: list[JobListing] = []
        seen_urls = set()

        # Scroll to load more cards
        for i in range(12):
            await page.evaluate("window.scrollBy(0, 800)")
            await page.wait_for_timeout(800)

        cards = await page.query_selector_all(".job-search-card")
        cards = cards[:100]

        for card in cards:
            try:
                title_el = await card.query_selector(".base-search-card__title")
                company_el = await card.query_selector(".base-search-card__subtitle")
                link_el = await card.query_selector("a.base-card__full-link")
                time_el = await card.query_selector("time[datetime]")
                logo_el = await card.query_selector("img.artdeco-entity-image")

                title = (await title_el.inner_text()).strip() if title_el else ""
                company = (await company_el.inner_text()).strip() if company_el else ""
                href = await link_el.get_attribute("href") if link_el else ""
                date_str = await time_el.get_attribute("datetime") if time_el else ""
                logo_url = await logo_el.get_attribute("src") if logo_el else None

                if not title or not href:
                    continue

                clean_url = href.split("?")[0]
                if clean_url in seen_urls:
                    continue
                seen_urls.add(clean_url)

                jobs.append(
                    JobListing(
                        title=title,
                        company=company,
                        url=clean_url,
                        date_posted=date_str or "",
                        source=JobSource.linkedin,
                        logo_url=logo_url,
                    )
                )
            except Exception:
                continue

        return jobs

    except Exception:
        return []
    finally:
        try:
            await context.close()
        except Exception:
            pass
