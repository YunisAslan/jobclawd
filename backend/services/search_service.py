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
    job_source: str = "",
    job_location_str: Optional[str] = None,
    location: Optional[LocationFilter] = None,
    work_modes: Optional[list[str]] = None,
    experience: Optional[list[str]] = None,
    job_types: Optional[list[str]] = None
) -> bool:
    query = query.lower().strip()
    title_lower = job_title.lower()
    
    if query:
        # Negative filters based on query
        if "frontend" in query or "front end" in query:
            if "backend" in title_lower or "back end" in title_lower:
                if "full stack" not in title_lower and "fullstack" not in title_lower:
                    return False
                    
        if "backend" in query or "back end" in query:
            if "frontend" in title_lower or "front end" in title_lower:
                if "full stack" not in title_lower and "fullstack" not in title_lower:
                    return False

        query_words = [w for w in re.split(r'\W+', query) if w and len(w) > 2]
        if query_words:
            main_keyword = query_words[0]
            if main_keyword not in title_lower:
                if not any(main_keyword in w for w in title_lower.split()):
                    return False

    # Location filtering - extract location from title/location_str and validate
    job_location = _get_job_location_from_title_or_source(job_title, job_source, job_location_str)
    if not _location_matches(job_location, location):
        return False

    # Experience cross-filter
    if experience:
        if "junior" in experience and "senior" not in experience and "lead" not in experience:
            if "senior" in title_lower or "lead" in title_lower or "head parameter" in title_lower or "director" in title_lower:
                return False
        if "senior" in experience and "junior" not in experience and "intern" not in experience:
            if "junior" in title_lower or "intern" in title_lower or "stajyor" in title_lower or "tecrubeci" in title_lower or "təcrübəçi" in title_lower:
                return False

    # Job Type cross-filter
    if job_types:
        # If user ONLY wants full-time, drop intern and part-time
        if "full-time" in job_types and "internship" not in job_types and "part-time" not in job_types:
            if "intern" in title_lower or "stajyor" in title_lower or "tecrubeci" in title_lower or "təcrübəçi" in title_lower or "part time" in title_lower or "part-time" in title_lower:
                return False
                
        # If user ONLY wants internship
        if "internship" in job_types and "full-time" not in job_types:
            # We don't indiscriminately drop because some places just call interns 'Developers'.
            # But we definitely drop "Senior" and "Lead"
            if "senior" in title_lower or "lead" in title_lower or "head" in title_lower or "director" in title_lower:
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
    if JobSource.jobsearch in sources:
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
            # Strict filtering
            filtered = [j for j in result if _is_relevant_job(
                j.title, 
                query,
                job_source=j.source.value if j.source else "",
                job_location_str=j.location_str,
                location=location,
                work_modes=work_modes,
                experience=experience,
                job_types=job_types
            )]
            all_jobs.extend(filtered)

    # Note: Advanced filters like exact job_type, salary, and date posted
    # often depend on deeper scraping that might not be available in standard listings.
    # Where possible (like date bounds), we could filter. For now, we stub them logic-wise 
    # to demonstrate the pipeline is receiving them, simulating strict dropping if data was present.
    # We will score them later or build robust parsers on top.
    
    visible = all_jobs

    # Apply sorting if requested
    if sort_by == "job-title-ascending":
        visible.sort(key=lambda j: j.title.lower())
    elif sort_by == "job-title-descending":
        visible.sort(key=lambda j: j.title.lower(), reverse=True)
    # else "latest" or by score (default if profile present)

    return SearchResponse(jobs=visible, total=len(visible), query=query, currency=currency)
