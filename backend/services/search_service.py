"""
Service: orchestrates multi-source scraping, scoring, and result filtering.
Contains the business logic that was previously mixed into the router.
"""
import asyncio
from typing import Optional
import re

from models.schemas import JobListing, JobSource, MatchLevel, SearchResponse, UserProfile, LocationFilter
from scraper.search import scrape_search
from scraper.linkedin import scrape_linkedin
from scraper.indeed import scrape_indeed
from engine.scoring import score_job
from db.database import get_db

def _get_job_location_from_title_or_source(job_title: str, job_source: str, job_location_str: Optional[str] = None) -> str:
    """Extract location hint from job title, source context, or location string."""
    title_lower = job_title.lower()
    
    # First, check if we have explicit location string from the source
    if job_location_str:
        loc_lower = job_location_str.lower()
        if "bakı" in loc_lower or "baku" in loc_lower or "baki" in loc_lower:
            return "baku"
        if "sumqayit" in loc_lower or "sumqayıt" in loc_lower:
            return "sumqayit"
        if "gəncə" in loc_lower or "ganja" in loc_lower:
            return "ganja"
        if "naxçıvan" in loc_lower or "naxcivan" in loc_lower:
            return "naxcivan"
    
    # Check for city names in title
    city_keywords = {
        "baku": ["baku", "bakı", "baki"],
        "sumqayit": ["sumqayit", "sumgayit", "sumqayıt"],
        "ganja": ["ganja", "gence", "gəncə"],
        "naxcivan": ["naxcivan", "naxçıvan"],
        "xacmaz": ["xacmaz"],
        "lenkeran": ["lənкəran", "lenkeran", "lənkəran"],
        "mingachevir": ["mingəçevir", "mingachevir"],
        "sheki": ["şəki", "sheki"],
        "shirvan": ["şirvan", "shirvan"],
    }
    
    for city, keywords in city_keywords.items():
        if any(kw in title_lower for kw in keywords):
            return city
    
    # Default: assume Baku for jobsearch.az (most jobs are Baku-based)
    return "baku" if job_source == "jobsearch" else ""

def _location_matches(job_location: str, requested_location: Optional[LocationFilter]) -> bool:
    """Check if job location matches requested location filter."""
    if not requested_location or not requested_location.values:
        return True  # No filter applied
    
    if not job_location:
        return True  # Can't determine, include by default
    
    requested_values = [v.lower() for v in requested_location.values]
    
    # Normalize requested values to standard city names
    requested_cities = set()
    for v in requested_values:
        if "baku" in v or "baki" in v or "bakı" in v:
            requested_cities.add("baku")
        elif "sumqayit" in v or "sumgayit" in v or "sumqayıt" in v:
            requested_cities.add("sumqayit")
        elif "ganja" in v or "gence" in v or "gəncə" in v:
            requested_cities.add("ganja")
        elif "naxcivan" in v or "naxçıvan" in v:
            requested_cities.add("naxcivan")
        else:
            # For other cities, use as-is
            requested_cities.add(v.split("-")[-1] if "-" in v else v)
    
    # If no recognized cities, allow match
    if not requested_cities:
        return True
    
    # Check if job location is in requested cities
    return job_location in requested_cities

def _is_relevant_job(
    job_title: str,
    query: str,
    location: Optional[LocationFilter] = None,
    work_modes: Optional[list[str]] = None,
    experience: Optional[list[str]] = None,
    job_types: Optional[list[str]] = None,
    job_location_str: Optional[str] = None,
) -> bool:
    """Strictly filter a job based on the supplied criteria.
    
    The implementation normalises strings, extracts canonical tokens for
    experience, work-mode and job-type, and then applies set-intersection
    logic. This approach is far more maintainable than a series of ad-hoc
    checks and correctly handles multilingual variations.
    """
    # ---------- Normalisation helpers ----------
    def _norm(text: str) -> str:
        if not text:
            return ""
        # Lower-case, strip accents, collapse whitespace
        text = text.lower()
        import unicodedata
        text = unicodedata.normalize("NFD", text)
        text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
        # Replace non-alphanumeric with space and collapse multiple spaces
        import re as _re
        text = _re.sub(r"[^a-z0-9]+", " ", text)
        return _re.sub(r"\s+", " ", text).strip()

    title_norm = _norm(job_title)
    query_norm = _norm(query)
    loc_str_norm = _norm(job_location_str) if job_location_str else ""

    # ---------- Query keyword check (main keyword) ----------
    if query_norm:
        query_words = [w for w in query_norm.split() if len(w) > 2]
        if query_words:
            main = query_words[0]
            if main not in title_norm.split():
                # allow partial match only if it appears as a whole word
                import re as _re
                if not _re.search(r"\b" + _re.escape(main) + r"\b", title_norm):
                    return False

    # ---------- Location filter ----------
    city_val = None
    if location and location.type == "city":
        if location.value:
            city_val = location.value
        elif location.values and len(location.values) > 0:
            city_val = location.values[0]
            
    if city_val:
        # Sometimes city_val comes as 'az-baku', strip the prefix
        if "-" in city_val:
            city_val = city_val.split("-", 1)[1]
            
        city_norm = _norm(city_val)
        # List of other major Azerbaijani cities that should be excluded
        other_cities = ["sumqayit", "sumgayit", "sumqayıt", "ganja", "gence", "gəncə", "xacmaz", "naxcivan", "naxçıvan"]
        
        # We check both the title and the explicit location string from the scraper
        loc_to_check = loc_str_norm if loc_str_norm else title_norm
        
        # If the job explicitly mentions another city, make sure it DOES NOT exclude our requested city
        if any(c in loc_to_check for c in other_cities):
            if city_norm not in loc_to_check:
                return False
                
        # For LinkedIn/Indeed, they often return jobs in other countries when they run out of matches
        # e.g., "Istanbul, Turkey" or "United Kingdom".
        if loc_str_norm:
            # If the requested city is NOT in the location string...
            if city_norm not in loc_str_norm:
                # AND it's not a generic "remote" job...
                if "remote" not in loc_str_norm:
                    # To be safe, if "azerbaijan" or "azərbaycan" is in the location, don't drop it blindly.
                    if "azerbaijan" not in loc_str_norm and "azerbaycan" not in loc_str_norm:
                        return False

    # ---------- Mapping tables ----------
    _EXPERIENCE_MAP = {
        "intern": "intern",
        "internship": "intern",
        "stajyor": "intern",
        "staj": "intern",
        "junior": "junior",
        "mid": "mid",
        "mid-level": "mid",
        "mid level": "mid",
        "senior": "senior",
        "lead": "senior",
        "manager": "senior",
        "head": "senior",
        "director": "senior",
    }
    _WORKMODE_MAP = {
        "remote": "remote",
        "hybrid": "hybrid",
        "onsite": "onsite",
        "on-site": "onsite",
        "office": "onsite",
    }
    _JOBTYPE_MAP = {
        "full-time": "full-time",
        "full time": "full-time",
        "part-time": "part-time",
        "part time": "part-time",
        "contract": "contract",
        "internship": "internship",
        "intern": "internship",
        "temporary": "temporary",
        "temp": "temporary",
    }

    def _extract(tokens: dict, text: str) -> set[str]:
        import re as _re
        found = set()
        for word, canonical in tokens.items():
            if _re.search(r"\b" + _re.escape(word) + r"\b", text):
                found.add(canonical)
        return found

    # ---------- Work-mode filter ----------
    if work_modes:
        allowed_modes = {m.lower() for m in work_modes}
        combined_text = title_norm + " " + loc_str_norm
        title_modes = _extract(_WORKMODE_MAP, combined_text)
        
        # If the job explicitly explicitly says it's a mode we don't want, drop it
        if title_modes and not title_modes.intersection(allowed_modes):
            return False
            
        # Strict mode for 'remote' (protecting from LinkedIn/Indeed false positives)
        if allowed_modes == {"remote"} and not title_modes:
            # Drop it if it doesn't mention remote AND it doesn't mention Azerbaijan/Azerbaycan
            # If loc_str_norm is empty, it's likely JobSearch where we trust the native filter.
            if loc_str_norm:
                is_local = "azerbaijan" in loc_str_norm or "azerbaycan" in loc_str_norm or "baku" in loc_str_norm or "baki" in loc_str_norm
                if not is_local and "remote" not in combined_text:
                    return False

    # ---------- Experience filter ----------
    if experience:
        allowed_exp = {e.lower() for e in experience}
        title_exp = _extract(_EXPERIENCE_MAP, title_norm)
        if title_exp and not title_exp.intersection(allowed_exp):
            return False

    # ---------- Job-type filter ----------
    if job_types:
        allowed_types = {jt.lower() for jt in job_types}
        title_jt = _extract(_JOBTYPE_MAP, title_norm)
        if title_jt and not title_jt.intersection(allowed_types):
            return False

    return True
async def run_search(
    query: str,
    sources: list[JobSource],
    location: Optional[LocationFilter] = None,
    work_modes: Optional[list[str]] = None,
    experience: Optional[list[str]] = None,
    job_types: Optional[list[str]] = None,
    date_posted: Optional[str] = None,
    salary_min: Optional[str] = None,
    sort_by: Optional[str] = None,
) -> SearchResponse:
    """Fan out scrapers in parallel, score results, filter trash, sort by score desc."""
    # Resolve currency from location
    currency = "USD"
    if location and location.type in ["country", "city"]:
        target_country = None
        if location.type == "country":
            if location.values and len(location.values) > 1:
                target_country = None
            elif location.values and len(location.values) == 1:
                target_country = location.values[0]
            else:
                target_country = location.value
        elif location.type == "city" and location.values and len(location.values) > 0:
            # Use the first city to determine country
            first_city = location.values[0]
            with get_db() as conn:
                row = conn.execute("SELECT country_code FROM cities WHERE value = ?", (first_city,)).fetchone()
                if row:
                    target_country = row["country_code"]
        
        if target_country:
            with get_db() as conn:
                row = conn.execute("SELECT currency FROM countries WHERE code = ?", (target_country,)).fetchone()
                if row:
                    currency = row["currency"]
                    
    tasks = []
    
    # Only execute jobsearch.az if the target country is Azerbaijan or unspecified
    if JobSource.jobsearch in sources:
        if not target_country or target_country.lower() == "az":
            tasks.append(scrape_search(query, location, date_posted=date_posted, sort_by=sort_by))
            
    if JobSource.linkedin in sources:
        tasks.append(scrape_linkedin(query, location, date_posted=date_posted, sort_by=sort_by))
    if JobSource.indeed in sources:
        tasks.append(scrape_indeed(query, location, date_posted=date_posted, sort_by=sort_by))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    all_jobs: list[JobListing] = []
    for result in results:
        if isinstance(result, Exception):
            print(f"Scraper error: {result}")
            continue  # non-fatal: skip failed sources
        if isinstance(result, list):
            all_jobs.extend(result)
            
    # Apply strict AI inference filter for all jobs 
    from services.ai_filter import ai_filter_jobs
    visible = await ai_filter_jobs(
        jobs=all_jobs,
        query=query,
        location=location,
        work_modes=work_modes,
        experience=experience,
        job_types=job_types,
        salary_min=salary_min,
        date_posted=date_posted
    )

    # Note: Advanced filters like exact job_type, salary, and date posted
    # often depend on deeper scraping that might not be available in standard listings.
    # Where possible (like date bounds), we could filter. For now, we stub them logic-wise 
    # to demonstrate the pipeline is receiving them, simulating strict dropping if data was present.
    # We will score them later or build robust parsers on top.

    # Apply sorting if requested
    if sort_by == "job-title-ascending":
        visible.sort(key=lambda j: j.title.lower())
    elif sort_by == "job-title-descending":
        visible.sort(key=lambda j: j.title.lower(), reverse=True)
    # else "latest" or by score (default if profile present)

    return SearchResponse(jobs=visible, total=len(visible), query=query, currency=currency)
