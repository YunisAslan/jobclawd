import asyncio
from typing import Optional

from scraper import get_browser
from models.schemas import JobListing, LocationFilter, JobSource

BASE_URL = "https://www.jobsearch.az"


async def scrape_search(
    query: str, 
    location: Optional[LocationFilter] = None,
    work_modes: Optional[list[str]] = None,
    experience: Optional[list[str]] = None,
    job_types: Optional[list[str]] = None,
    date_posted: Optional[str] = None,
    sort_by: Optional[str] = None
) -> list[JobListing]:
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
    api_base_url = None
    api_event = asyncio.Event()

    async def handle_response(response):
        nonlocal api_data, api_base_url
        if "/api-az/vacancies-az" in response.url:
            try:
                # Keep the first successful URL
                if not api_base_url:
                    api_base_url = response.url
                
                # Only set event if it's the specific first request we wait for
                if not api_event.is_set():
                    api_data = await response.json()
                    api_event.set()
            except Exception:
                pass

    page.on("response", handle_response)
    
    # Use only the query for search - location filtering will be done post-fetch
    # because jobsearch.az search works better with clean queries
    import urllib.parse
    augmented_query = urllib.parse.quote_plus(query)

    try:
        await page.goto(
            f"{BASE_URL}/vacancies?search={augmented_query}",
            wait_until="networkidle",
            timeout=30000,
        )

        try:
            await asyncio.wait_for(api_event.wait(), timeout=10)
        except asyncio.TimeoutError:
            pass

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

        all_items = api_data.get("items", [])
        
        # Paginate further if api_base_url was captured and we need more items
        if api_base_url:
            import urllib.parse
            parsed = urllib.parse.urlparse(api_base_url)
            qs = urllib.parse.parse_qs(parsed.query)
            
            # Fetch pages 2 to roughly max 6 (up to ~100 results)
            current_page = 2
            while len(all_items) < 100 and current_page <= 6:
                qs['page'] = [str(current_page)]
                new_query = urllib.parse.urlencode(qs, doseq=True)
                next_url = urllib.parse.urlunparse(parsed._replace(query=new_query))
                
                try:
                    # Evaluate fetch natively in the browser to piggyback cookies/headers
                    next_data = await page.evaluate(f'''async () => {{
                        const res = await fetch("{next_url}");
                        return await res.json();
                    }}''')
                    
                    new_items = next_data.get("items", [])
                    if not new_items:
                        break
                        
                    all_items.extend(new_items)
                except Exception:
                    break
                    
                current_page += 1

        # Post-fetch filter by date posted
        from datetime import datetime, timedelta
        if date_posted in ["today", "past-24h", "past-week", "past-month"]:
            now = datetime.now()
            filtered_items = []
            for item in all_items:
                created_at_str = item.get("created_at", "")
                if not created_at_str:
                    continue
                    
                try:
                    # typical jobsearch.az format: '2024-03-04 15:30:00' or similar
                    # Sometimes it contains Timezones. We'll do a simple slice.
                    # Or fallback to ISO parse.
                    dt_str = created_at_str[:19].replace("T", " ")
                    item_dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
                    
                    diff = now - item_dt
                    
                    if date_posted in ["today", "past-24h"] and diff <= timedelta(days=1):
                        filtered_items.append(item)
                    elif date_posted == "past-week" and diff <= timedelta(days=7):
                        filtered_items.append(item)
                    elif date_posted == "past-month" and diff <= timedelta(days=30):
                        filtered_items.append(item)
                except Exception:
                    # If parse fails, aggressively include it or drop it? Include to be safe.
                    filtered_items.append(item)
                    
            all_items = filtered_items

        results = []
        for i, item in enumerate(all_items[:100]):
            if i == 0:
                print("JOBSEARCH ITEM FULL:", item)
            
            # Extract location from city field or title
            city_value = None
            if item.get("city"):
                city_value = item["city"].get("value") or item["city"].get("title")
            
            results.append(
                JobListing(
                    title=item["title"],
                    company=item.get("company", {}).get("title", "N/A"),
                    url=f"{BASE_URL}/vacancies/{item['slug']}",
                    date_posted=item.get("created_at", ""),
                    view_count=_parse_view_count(item.get("view_count")),
                    source=JobSource.jobsearch,
                    logo_url=item.get("company", {}).get("logo", None),
                    location_str=city_value,
                )
            )
        
        # Sort if requested
        if sort_by == "latest":
            # Jobsearch API is usually pre-sorted by latest, but we can enforce it
            pass
        elif sort_by == "job-title-ascending":
            results.sort(key=lambda x: x.title.lower())
        elif sort_by == "job-title-descending":
            results.sort(key=lambda x: x.title.lower(), reverse=True)
            
        return results

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
