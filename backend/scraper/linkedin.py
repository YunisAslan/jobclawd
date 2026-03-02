"""LinkedIn job scraper — non-fatal, returns [] on any error."""

from urllib.parse import quote_plus
from scraper import get_browser
from models.schemas import JobListing, JobSource


async def scrape_linkedin(query: str) -> list[JobListing]:
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
        url = (
            f"https://www.linkedin.com/jobs/search/"
            f"?keywords={encoded_query}&location=Azerbaijan&f_TPR=r86400"
        )

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=25000)
            await page.wait_for_timeout(3000)
        except Exception:
            return []

        jobs: list[JobListing] = []

        # Scroll to load more cards
        for _ in range(3):
            await page.evaluate("window.scrollBy(0, 600)")
            await page.wait_for_timeout(600)

        cards = await page.query_selector_all(".job-search-card")
        cards = cards[:20]

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

                jobs.append(
                    JobListing(
                        title=title,
                        company=company,
                        url=href.split("?")[0] if href else "",
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
