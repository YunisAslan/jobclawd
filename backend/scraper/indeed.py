"""Indeed (az) job scraper — non-fatal, returns [] on any error."""

from urllib.parse import quote_plus
from scraper import get_browser
from models.schemas import JobListing, JobSource

INDEED_BASE = "https://az.indeed.com"


async def scrape_indeed(query: str) -> list[JobListing]:
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
        url = f"{INDEED_BASE}/jobs?q={encoded_q}&l=Bak%C4%B1&fromage=1"

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=25000)
            await page.wait_for_timeout(2000)
        except Exception:
            return []

        jobs: list[JobListing] = []
        cards = await page.query_selector_all("[data-jk]")
        cards = cards[:20]

        for card in cards:
            try:
                jk = await card.get_attribute("data-jk")
                title_el = await card.query_selector('[data-testid="jobTitle"] span')
                company_el = await card.query_selector('[data-testid="company-name"]')
                date_el = await card.query_selector('[data-testid="myJobsStateDate"]')

                title = (await title_el.inner_text()).strip() if title_el else ""
                company = (await company_el.inner_text()).strip() if company_el else ""
                date_str = (await date_el.inner_text()).strip() if date_el else ""

                if not title or not jk:
                    continue

                job_url = f"{INDEED_BASE}/viewjob?jk={jk}"
                jobs.append(
                    JobListing(
                        title=title,
                        company=company,
                        url=job_url,
                        date_posted=date_str,
                        source=JobSource.indeed,
                    )
                )
            except Exception:
                continue

        return jobs

    except Exception:
        return []
    finally:
        try:
            if context:
                await context.close()
        except Exception:
            pass
