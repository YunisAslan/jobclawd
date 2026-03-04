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
    import urllib.parse
    
    query_parts = {}
    if query:
        query_parts["search"] = query
        
    # Location (Region)
    city_val = None
    if location and location.type in ["city", "country"]:
        if location.value:
            city_val = location.value
        elif location.values and len(location.values) > 0:
            city_val = location.values[0]
            
    if city_val:
        if "-" in city_val:
            city_val = city_val.split("-", 1)[1]
        
        city_lower = city_val.lower()
        if "baku" in city_lower or "bakı" in city_lower or "baki" in city_lower:
            query_parts["region"] = "8"
        elif "sumqayit" in city_lower or "sumgayit" in city_lower or "sumqayıt" in city_lower:
            query_parts["region"] = "62"
        elif "ganja" in city_lower or "gəncə" in city_lower or "gence" in city_lower:
            query_parts["region"] = "21"
        elif "naxcivan" in city_lower or "naxçıvan" in city_lower:
            query_parts["region"] = "53"
            
    # Experience (Vəzifə dərəcəsi)
    # 0:Təcrübəçi, 1:Köməkçi, 2:Mütəxəssis, 3:Menecer, 4:Direktor, 5:Yuxarı rəhbərlik
    if experience:
        exp_vals = []
        for exp in experience:
            e = exp.lower()
            if "junior" in e or "intern" in e:
                exp_vals.extend(["0", "1"])
            if "mid" in e:
                exp_vals.append("2")
            if "senior" in e or "lead" in e:
                exp_vals.extend(["3", "4", "5"])
        if exp_vals:
            query_parts["vacancy_type"] = ",".join(list(set(exp_vals)))
            
    # Job Types / Work Modes (Məşğulluq növü)
    # 0:Tam, 1:Natamam, 2:Təcrübə, 3:Müvəqqəti, 4:Distant, 5:Frilans
    em_vals = []
    if job_types:
        for jt in job_types:
            j = jt.lower()
            if "full-time" in j: em_vals.append("0")
            elif "part-time" in j: em_vals.append("1")
            elif "internship" in j: em_vals.append("2")
            elif "temporary" in j or "contract" in j: em_vals.append("3")
    if work_modes:
        for wm in work_modes:
            w = wm.lower()
            if "remote" in w: em_vals.append("4")
    if em_vals:
        query_parts["employment_type"] = ",".join(list(set(em_vals)))
        
    qs = urllib.parse.urlencode(query_parts) if query_parts else ""

    try:
        await page.goto(
            f"{BASE_URL}/vacancies?{qs}",
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
            
            # Fetch pages 2 to roughly max 15 for more results, sorted by fresh
            current_page = 2
            while current_page <= 15:
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
        if date_posted in ("1d", "today", "past-24h", "3d", "7d", "past-week", "1m", "past-month"):
            now = datetime.now()
            filtered_items = []
            for item in all_items:
                created_at_str = item.get("created_at", "")
                if not created_at_str:
                    continue
                    
                try:
                    dt_str = created_at_str[:19].replace("T", " ")
                    item_dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
                    diff = now - item_dt
                    
                    if date_posted in ("1d", "today", "past-24h") and diff <= timedelta(days=1):
                        filtered_items.append(item)
                    elif date_posted == "3d" and diff <= timedelta(days=3):
                        filtered_items.append(item)
                    elif date_posted in ("7d", "past-week") and diff <= timedelta(days=7):
                        filtered_items.append(item)
                    elif date_posted in ("1m", "past-month") and diff <= timedelta(days=30):
                        filtered_items.append(item)
                except Exception:
                    filtered_items.append(item)
                    
            all_items = filtered_items

        print(f"[JobSearch] Fetched {len(all_items)} items for '{query}'")

        results = []
        for i, item in enumerate(all_items):
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
        
        # Sort by most recent by default
        if sort_by == "job-title-ascending":
            results.sort(key=lambda x: x.title.lower())
        elif sort_by == "job-title-descending":
            results.sort(key=lambda x: x.title.lower(), reverse=True)
        else:
            # Default: sort by date posted descending (newest first)
            results.sort(key=lambda x: x.date_posted, reverse=True)
            
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
