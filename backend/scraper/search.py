import asyncio
from typing import Optional

from scraper import get_browser
from models.schemas import JobListing

BASE_URL = "https://www.jobsearch.az"


async def scrape_search(query: str) -> list[JobListing]:
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

    api_data = None
    api_event = asyncio.Event()

    async def handle_response(response):
        nonlocal api_data
        if "/api-az/vacancies-az" in response.url:
            try:
                api_data = await response.json()
                api_event.set()
            except Exception:
                pass

    page.on("response", handle_response)

    try:
        # Navigate to the vacancies page with the search query.
        # The site's own JS will call /api-az/vacancies-az?q=... automatically.
        await page.goto(
            f"{BASE_URL}/vacancies?search={query}",
            wait_until="networkidle",
            timeout=30000,
        )

        # Wait for the API response to be captured (max 10s)
        try:
            await asyncio.wait_for(api_event.wait(), timeout=10)
        except asyncio.TimeoutError:
            pass

        # If the page loaded but the initial request didn't include our query,
        # type the query into the search input to trigger a new API call.
        if api_data is None or not _has_query(api_data, query):
            api_data = None
            api_event.clear()

            search_input = page.locator('input[type="text"], input[type="search"], input[name="search"], input[placeholder*="axtar" i]').first
            await search_input.fill(query)
            await search_input.press("Enter")

            try:
                await asyncio.wait_for(api_event.wait(), timeout=15)
            except asyncio.TimeoutError:
                pass

        if api_data is None:
            return []

        items = api_data.get("items", [])

        return [
            JobListing(
                title=item["title"],
                company=item.get("company", {}).get("title", "N/A"),
                url=f"{BASE_URL}/vacancies/{item['slug']}",
                date_posted=item.get("created_at", ""),
                view_count=_parse_view_count(item.get("view_count")),
                source="jobsearch",
                logo_url=item.get("company", {}).get("logo", None),
            )
            for item in items
        ]

    finally:
        await context.close()


def _parse_view_count(value) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    s = str(value).strip().upper()
    if not s:
        return None
    try:
        if s.endswith("K"):
            return int(float(s[:-1]) * 1000)
        if s.endswith("M"):
            return int(float(s[:-1]) * 1_000_000)
        return int(s)
    except (ValueError, TypeError):
        return None


def _has_query(data: dict, query: str) -> bool:
    """Check if the API response items seem relevant to the query."""
    items = data.get("items", [])
    if not items:
        return False
    # If there are items, assume the response is valid
    return True
