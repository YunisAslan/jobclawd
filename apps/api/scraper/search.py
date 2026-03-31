from typing import Optional
import asyncio
import re

from scraper import get_browser
from models.schemas import JobListing, LocationFilter, JobSource
from utils.email_extractor import extract_emails
from utils.job_meta_extractor import extract_all as extract_meta


def _strip_html(text: str) -> str:
    """Remove HTML tags and normalize whitespace."""
    clean = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", clean).strip()


def _extract_email_from_item(item: dict) -> Optional[str]:
    """Try to get HR email from jobsearch.az API item fields."""
    # Direct email fields
    for key in ("email", "contact_email", "hr_email"):
        v = item.get(key)
        if isinstance(v, str) and "@" in v:
            return v.strip()

    # Nested contacts object
    contacts = item.get("contacts") or item.get("contact") or {}
    if isinstance(contacts, dict):
        for key in ("email", "contact_email"):
            v = contacts.get(key)
            if isinstance(v, str) and "@" in v:
                return v.strip()

    # Fallback: regex scan over the item JSON text
    import json
    raw = json.dumps(item)
    found = extract_emails(raw)
    return found[0] if found else None

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
            
            # Fetch pages 2-5 for more results (cap at ~100 jobs for speed)
            current_page = 2
            while current_page <= 5:
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

                    # Quick safety check: if last item is already older than 35 days, stop fetching
                    if new_items:
                        last_item = new_items[-1]
                        created_at = last_item.get("created_at", "")
                        if created_at:
                            try:
                                from datetime import datetime, timedelta
                                item_dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                                if datetime.now(item_dt.tzinfo) - item_dt > timedelta(days=35):
                                    break
                            except: pass
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

        # Scrape logos from rendered DOM cards (API returns empty logo strings)
        # Map: slug -> logo_url
        slug_to_logo: dict[str, str] = {}
        try:
            cards = await page.query_selector_all(".vacancy-list__item, .list__item")
            for card in cards:
                # Get slug from the card link
                link_el = await card.query_selector("a[href*='/vacancies/']")
                card_slug = None
                if link_el:
                    href = await link_el.get_attribute("href")
                    if href and "/vacancies/" in href:
                        card_slug = href.split("/vacancies/")[-1].strip("/")
                
                # Get logo img from the card
                logo_img = await card.query_selector(".list__item__logo img, .vacancy-list__item__logo img, img[class*='logo']")
                if logo_img and card_slug:
                    src = await logo_img.get_attribute("src")
                    if src and src.startswith("http"):
                        slug_to_logo[card_slug] = src
        except Exception as e:
            print(f"[JobSearch] Logo scrape warning: {e}")

        results = []
        # Debug: log first item structure to understand API fields
        if all_items:
            sample = all_items[0]
            print(
                f"[JobSearch] API item sample keys: {list(sample.keys())}"
            )
            if "employment_type" in sample:
                print(f"[JobSearch] employment_type sample: {sample['employment_type']}")
            if "work_type" in sample:
                print(f"[JobSearch] work_type sample: {sample['work_type']}")
            if "type" in sample:
                print(f"[JobSearch] type sample: {sample['type']}")

        for item in all_items:
            # Extract location from city field or title
            city_value = None
            if item.get("city"):
                city_value = item["city"].get("value") or item["city"].get("title")

            item_slug = item['slug']
            logo_url = slug_to_logo.get(item_slug) or item.get("company", {}).get("logo") or None
            
            hr_email = _extract_email_from_item(item)
            # --- Extract structured metadata from API item fields ---
            experience_str = None
            experience_src = None
            seniority_str = None
            seniority_src = None
            job_type_str = None
            job_type_src = None
            work_mode_str = None
            work_mode_src = None

            # employment_type from API: 0=Tam(Full-time), 1=Natamam(Part-time),
            # 2=Təcrübə(Internship), 3=Müvəqqəti(Temporary), 4=Distant(Remote), 5=Frilans
            emp_type = item.get("employment_type")
            if isinstance(emp_type, dict):
                emp_id = emp_type.get("id")
                if emp_id == 4:
                    work_mode_str = "Remote"
                    work_mode_src = "structured"
                elif emp_id == 0:
                    job_type_str = "Full-time"
                    job_type_src = "structured"
                elif emp_id == 1:
                    job_type_str = "Part-time"
                    job_type_src = "structured"
                elif emp_id == 2:
                    job_type_str = "Internship"
                    job_type_src = "structured"
                elif emp_id == 3:
                    job_type_str = "Temporary"
                    job_type_src = "structured"
                elif emp_id == 5:
                    job_type_str = "Freelance"
                    job_type_src = "structured"
            elif isinstance(emp_type, list):
                for et in emp_type:
                    if isinstance(et, dict):
                        eid = et.get("id")
                        if eid == 4:
                            work_mode_str = "Remote"
                            work_mode_src = "structured"
                        elif eid == 0 and not job_type_str:
                            job_type_str = "Full-time"
                            job_type_src = "structured"
                        elif eid == 1 and not job_type_str:
                            job_type_str = "Part-time"
                            job_type_src = "structured"
                        elif eid == 2 and not job_type_str:
                            job_type_str = "Internship"
                            job_type_src = "structured"
                        elif eid == 3 and not job_type_str:
                            job_type_str = "Temporary"
                            job_type_src = "structured"
                        elif eid == 5 and not job_type_str:
                            job_type_str = "Freelance"
                            job_type_src = "structured"

            # vacancy_type from API:
            # 0=Təcrübəçi, 1=Köməkçi, 2=Mütəxəssis, 3=Menecer, 4=Direktor, 5=Yuxarı rəhbərlik
            vac_type = item.get("vacancy_type")
            vac_ids: list[int] = []
            if isinstance(vac_type, dict) and vac_type.get("id") is not None:
                try:
                    vac_ids.append(int(vac_type.get("id")))
                except (TypeError, ValueError):
                    pass
            elif isinstance(vac_type, list):
                for vt in vac_type:
                    if isinstance(vt, dict) and vt.get("id") is not None:
                        try:
                            vac_ids.append(int(vt.get("id")))
                        except (TypeError, ValueError):
                            pass
            for vac_id in vac_ids:
                if vac_id == 0 and not experience_str:
                    seniority_str = "Intern"
                    seniority_src = "structured"
                    experience_str = "Internship"
                    experience_src = "structured"
                elif vac_id == 1 and not experience_str:
                    seniority_str = "Junior"
                    seniority_src = "structured"
                    experience_str = "Junior"
                    experience_src = "structured"
                elif vac_id == 2 and not experience_str:
                    seniority_str = "Mid-level"
                    seniority_src = "structured"
                    experience_str = "Mid-level"
                    experience_src = "structured"
                elif vac_id == 3 and not experience_str:
                    seniority_str = "Senior"
                    seniority_src = "structured"
                    experience_str = "Senior"
                    experience_src = "structured"
                elif vac_id in {4, 5} and not experience_str:
                    seniority_str = "Lead"
                    seniority_src = "structured"
                    experience_str = "Lead"
                    experience_src = "structured"

            # Salary: regex on description + API salary object (numeric, reliable)
            desc_text = item.get("description") or item.get("short_description") or ""
            meta = extract_meta(desc_text) if desc_text else {}
            salary_str = meta.get("salary_str")
            salary_src = "regex" if salary_str else None
            if not salary_str:
                salary_obj = item.get("salary")
                if isinstance(salary_obj, dict):
                    s_min = salary_obj.get("min") or salary_obj.get("from")
                    s_max = salary_obj.get("max") or salary_obj.get("to")
                    s_cur = salary_obj.get("currency", "")
                    if s_min and s_max:
                        salary_str = f"{s_min}-{s_max} {s_cur}".strip()
                        salary_src = "structured"
                    elif s_min:
                        salary_str = f"{s_min}+ {s_cur}".strip()
                        salary_src = "structured"
                elif isinstance(salary_obj, str) and salary_obj.strip():
                    salary_str = salary_obj.strip()
                    salary_src = "structured"

            # Build a description snippet so filters can analyse the full text
            raw_desc = item.get("description") or item.get("short_description") or ""
            snippet = _strip_html(raw_desc)[:500] if raw_desc else None

            # Default: Full-time and On-site when not explicitly set
            if not job_type_str:
                job_type_str = "Full-time"
                job_type_src = "default"
            if not work_mode_str:
                work_mode_str = "On-site"
                work_mode_src = "default"

            results.append(
                JobListing(
                    title=item["title"],
                    company=item.get("company", {}).get("title", "N/A"),
                    url=f"{BASE_URL}/vacancies/{item_slug}",
                    date_posted=item.get("created_at", ""),
                    view_count=_parse_view_count(item.get("view_count")),
                    source=JobSource.jobsearch,
                    logo_url=logo_url,
                    location_str=city_value,
                    hr_email=hr_email,
                    description_snippet=snippet,
                    salary_str=salary_str,
                    salary_src=salary_src,
                    job_type_str=job_type_str,
                    job_type_src=job_type_src,
                    seniority_str=seniority_str,
                    seniority_src=seniority_src,
                    experience_str=experience_str,
                    experience_src=experience_src,
                    work_mode_str=work_mode_str,
                    work_mode_src=work_mode_src,
                )
            )
        
        # ── AI extraction runs in background — don't block search ──
        # Structured API fields are enough for filtering. AI enriches later
        # via the background enrichment task in search_service.py.

        # Log final metadata coverage
        total = len(results)
        if total > 0:
            filled = {
                "salary": sum(1 for j in results if j.salary_str),
                "job_type": sum(1 for j in results if j.job_type_str),
                "experience": sum(1 for j in results if j.experience_str),
                "work_mode": sum(1 for j in results if j.work_mode_str),
            }
            print(
                f"[JobSearch] Metadata coverage ({total} jobs): "
                f"salary={filled['salary']} "
                f"job_type={filled['job_type']} "
                f"experience={filled['experience']} "
                f"work_mode={filled['work_mode']}"
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
