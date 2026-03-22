import re
from datetime import datetime, timedelta
from typing import Optional
import pycountry
from models.schemas import JobListing, LocationFilter


def _pycountry_terms(iso2: str) -> set[str]:
    """Return all ISO 3166-1 name variants for a country."""
    try:
        c = pycountry.countries.get(alpha_2=iso2.upper())
        if c:
            terms = {c.name.lower()}
            if hasattr(c, "common_name"):
                terms.add(c.common_name.lower())
            if hasattr(c, "official_name"):
                terms.add(c.official_name.lower())
            return terms
    except Exception:
        pass
    return set()


def tokenize(text: str) -> set[str]:
    if not text:
        return set()
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def _job_search_text(job: JobListing) -> str:
    parts = [
        job.title or "",
        job.company or "",
        job.location_str or "",
        job.description_snippet or "",
        job.salary_str or "",
        job.job_type_str or "",
        job.experience_str or "",
        job.work_mode_str or "",
    ]
    return " ".join(part for part in parts if part).strip()


def _normalize_filter_value(value: str) -> str:
    lowered = (value or "").strip().lower()
    aliases = {
        "onsite": "onsite",
        "on-site": "onsite",
        "on site": "onsite",
        "remote": "remote",
        "hybrid": "hybrid",
        "full-time": "full-time",
        "full time": "full-time",
        "part-time": "part-time",
        "part time": "part-time",
        "internship": "internship",
        "intern": "internship",
        "temporary": "temporary",
        "temp": "temporary",
        "contract": "contract",
        "freelance": "freelance",
        "commission": "commission",
        "seasonal": "seasonal",
    }
    return aliases.get(lowered, lowered)


DOMAINS = {
    "frontend": {"frontend", "front", "react", "vue", "angular", "javascript", "ui", "typescript", "next", "nextjs"},
    "backend": {"backend", "back", "php", "python", "java", "node", "c#", "golang", "ruby", "laravel", "django", "spring"},
    "qa": {"qa", "quality", "tester", "test", "automation", "selenium", "cypress", "manual"},
    "data": {"data", "scientist", "analyst", "machine", "learning", "ml", "ai", "sql", "database"},
    "design": {"designer", "design", "ui", "ux", "product", "figma"},
    "devops": {"devops", "sysadmin", "cloud", "aws", "infrastructure", "sre", "linux", "docker", "kubernetes"},
    "mobile": {"mobile", "ios", "android", "native", "flutter", "swift", "kotlin"},
    "hr": {"hr", "human", "resources", "recruiter", "talent", "acquisition"},
    "sales": {"sales", "account", "manager", "representative", "b2b", "business", "development"},
}

SENIOR_WORDS = {"senior", "lead", "head", "director", "principal", "manager", "expert", "sr"}
ENTRY_WORDS = {"intern", "internship", "trainee", "graduate", "fresher", "freshmen", "stajyer", "entry"}

DATE_THRESHOLDS = {
    "1d": timedelta(days=1, hours=4), "today": timedelta(days=1, hours=4), "past-24h": timedelta(days=1, hours=4),
    "3d": timedelta(days=3, hours=4),
    "7d": timedelta(days=7, hours=4), "past-week": timedelta(days=7, hours=4),
    "1m": timedelta(days=31, hours=4), "past-month": timedelta(days=31, hours=4),
}


def _resolve_target_domains(query: str) -> tuple[str, set[str], set[str]]:
    q_raw = query.lower()
    q_tokens = tokenize(query)
    target_domains: set[str] = set()

    for dom, keywords in DOMAINS.items():
        if dom in q_tokens or any(k in q_tokens for k in keywords):
            target_domains.add(dom)

    if not target_domains:
        for dom in DOMAINS:
            if dom in q_raw:
                target_domains.add(dom)

    return q_raw, q_tokens, target_domains


def _build_location_whitelist(
    location: Optional[LocationFilter],
) -> tuple[bool, set[str], set[str]]:
    """Build allowed country terms and city names from DB + pycountry."""
    if not location or not location.values:
        return False, set(), set()

    if "worldwide" in location.values:
        return True, set(), set()

    allowed_country_terms: set[str] = set()
    allowed_cities: set[str] = set()

    from db.database import get_db
    try:
        with get_db() as conn:
            for val in location.values:
                c_code = None

                crow = conn.execute("SELECT name, code FROM countries WHERE code = %s", (val,)).fetchone()
                if crow:
                    allowed_country_terms.add(crow["name"].lower())
                    c_code = crow["code"]

                city_row = conn.execute("SELECT name, country_code FROM cities WHERE value = %s", (val,)).fetchone()
                if city_row:
                    allowed_cities.add(city_row["name"].lower())
                    c_code = city_row["country_code"]
                    c_row2 = conn.execute("SELECT name FROM countries WHERE code = %s", (c_code,)).fetchone()
                    if c_row2:
                        allowed_country_terms.add(c_row2["name"].lower())

                if c_code:
                    allowed_country_terms.update(_pycountry_terms(c_code))
                    all_cities = conn.execute(
                        "SELECT name FROM cities WHERE country_code = %s", (c_code,)
                    ).fetchall()
                    for ac in all_cities:
                        allowed_cities.add(ac["name"].lower())

    except Exception as e:
        print(f"[AIFilter] DB Location fetch error: {e}")

    # Fallback: DB not seeded — use pycountry directly
    if not allowed_country_terms and not allowed_cities:
        for val in location.values:
            terms = _pycountry_terms(val)
            if terms:
                allowed_country_terms.update(terms)
            else:
                raw = val.lower()
                if "-" in raw:
                    raw = raw.split("-", 1)[1]
                if raw:
                    allowed_country_terms.add(raw)

    return False, allowed_country_terms, allowed_cities


def _passes_keyword_filter(
    combined_raw: str, combined_tokens: set[str], title_tokens: set[str],
    q_raw: str, q_tokens: set[str], target_domains: set[str],
) -> bool:
    if target_domains:
        has_target_keyword = any(
            any(k in combined_tokens for k in DOMAINS[dom])
            for dom in target_domains
        )
        if not has_target_keyword and not (q_tokens & combined_tokens) and q_raw not in combined_raw:
            return False
    else:
        if not (q_tokens & combined_tokens) and q_raw not in combined_raw:
            return False

    return True


def _detect_experience_from_text(title_tokens: set[str], combined_tokens: set[str]) -> set[str]:
    """Detect experience levels from title/description tokens."""
    detected: set[str] = set()

    if title_tokens & ENTRY_WORDS or combined_tokens & ENTRY_WORDS:
        detected.update({"intern", "junior"})
    if "junior" in combined_tokens or "jr" in combined_tokens:
        detected.add("junior")
    if "mid" in combined_tokens or "middle" in combined_tokens:
        detected.add("mid")
    if "senior" in combined_tokens or "sr" in combined_tokens or title_tokens & SENIOR_WORDS:
        detected.add("senior")
    if any(token in combined_tokens for token in {"lead", "principal", "staff", "manager", "head"}):
        detected.update({"lead", "senior"})

    return detected


def _experience_categories(value: str) -> set[str]:
    lowered = (value or "").strip().lower()
    if not lowered:
        return set()

    categories: set[str] = set()
    if "no experience" in lowered or "intern" in lowered or "entry-level" in lowered or "entry level" in lowered:
        categories.update({"intern", "junior"})
    if "junior" in lowered:
        categories.add("junior")
    if "mid" in lowered:
        categories.add("mid")
    if "senior" in lowered:
        categories.add("senior")
    if any(word in lowered for word in ("lead", "principal", "staff", "manager", "head")):
        categories.update({"lead", "senior"})

    year_match = re.search(r"(\d+)(?:\s*[\+\-–]|(?:\s*to\s*\d+)?)?\s*years?", lowered)
    if year_match:
        years = int(year_match.group(1))
        if years <= 1:
            categories.update({"intern", "junior"})
        elif years <= 2:
            categories.add("junior")
        elif years <= 4:
            categories.add("mid")
        elif years <= 6:
            categories.add("senior")
        else:
            categories.update({"senior", "lead"})

    return categories


def _passes_location_filter(
    loc_str: str, worldwide: bool, allowed_country_terms: set[str], allowed_cities: set[str],
) -> bool:
    if worldwide:
        return True

    loc_lower = loc_str.lower().strip()
    if not loc_lower:
        return False

    for term in allowed_country_terms:
        if term in loc_lower:
            return True

    loc_tokens = set(re.split(r'[^a-z0-9äöüßçğışə]+', loc_lower)) - {""}
    if loc_tokens & allowed_cities:
        return True

    if "remote" in loc_lower and len(loc_tokens) <= 3:
        return True

    return False


def _detected_work_modes(combined_text: str) -> set[str]:
    combined = combined_text.lower()
    detected: set[str] = set()
    if re.search(r"\b(remote|work\s+from\s+home|wfh)\b", combined):
        detected.add("remote")
    if re.search(r"\bhybrid\b", combined):
        detected.add("hybrid")
    if re.search(r"\b(on[\s\-]?site|in[\s\-]?office|office[\s\-]?based)\b", combined):
        detected.add("onsite")
    return detected


def _parse_job_date(raw: str) -> Optional[datetime]:
    raw = raw.strip()

    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if dt.tzinfo is not None:
            from datetime import timezone as _tz
            dt = dt.astimezone(_tz.utc).replace(tzinfo=None)
        return dt
    except ValueError:
        pass

    m = re.search(r"(\d+)\s*(hour|day|week|minute)", raw, re.I)
    if m:
        amount = int(m.group(1))
        unit = m.group(2).lower()
        delta = {"hour": timedelta(hours=amount), "minute": timedelta(minutes=amount),
                 "day": timedelta(days=amount), "week": timedelta(weeks=amount)}.get(unit)
        if delta:
            return datetime.utcnow() - delta

    return None


def _passes_date_filter(date_posted_raw: Optional[str], date_filter: str) -> bool:
    if date_filter in ("all", "any") or not date_posted_raw:
        return True

    job_dt = _parse_job_date(date_posted_raw)
    if job_dt is None:
        return True

    threshold = DATE_THRESHOLDS.get(date_filter)
    if threshold and (datetime.utcnow() - job_dt) > threshold:
        return False

    return True


# Salary regex patterns (order matters — ranges before single values)
_SALARY_PATTERNS = [
    # Range k–k: "$30k-$50k"
    (re.compile(r"[\$£€]?\s*\d+(?:\.\d+)?\s*k\s*[-–]\s*[\$£€]?\s*(\d+(?:\.\d+)?)\s*k"), "k"),
    # Range plain–k: "30-50k"
    (re.compile(r"[\$£€]?\s*\d+\s*[-–]\s*[\$£€]?\s*(\d+(?:\.\d+)?)\s*k"), "k"),
    # Range explicit: "$30,000 - $50,000"
    (re.compile(r"[\$£€]?\s*\d{2,3}(?:[.,]\d{3})+\s*[-–]\s*[\$£€]?\s*(\d{2,3}(?:[.,]\d{3})+)"), "explicit"),
    # Hourly: "$40/hr"
    (re.compile(r"[\$£€]?\s*(\d+(?:[.,]\d+)?)\s*(?:/\s*h(?:r|our)?|per\s*h(?:r|our))"), "hourly"),
    # Annual k: "$80k"
    (re.compile(r"[\$£€]?\s*(\d+(?:\.\d+)?)\s*k(?:/yr)?"), "k"),
    # Explicit annual: "$120,000"
    (re.compile(r"[\$£€]?\s*(\d{2,3}(?:[.,]\d{3})+)(?:\s*/\s*yr|\s*(?:usd|eur|gbp|cad|aud))?"), "explicit"),
]


def _passes_salary_filter(combined_text: str, annual_min: int) -> bool:
    combined = combined_text.lower()

    for pattern, kind in _SALARY_PATTERNS:
        m = pattern.search(combined)
        if not m:
            continue

        try:
            raw_val = m.group(1).replace(",", "").replace(".", "")
            if kind == "k":
                amount = float(m.group(1)) * 1000
            elif kind == "hourly":
                amount = float(m.group(1).replace(",", ".")) * 2080
            else:
                amount = int(raw_val) if int(raw_val) >= 1000 else float("inf")
            return amount >= annual_min
        except (ValueError, TypeError):
            return True

    # No salary info found — keep the job
    return False


def _detect_job_types_from_text(combined_text: str) -> set[str]:
    """Detect job types from text via regex."""
    combined = combined_text.lower()
    detected: set[str] = set()

    if re.search(r'\bfull[\s\-]?time\b', combined):
        detected.add("full-time")
    if re.search(r'\bpart[\s\-]?time\b|\bp/t\b', combined):
        detected.add("part-time")
    if re.search(r'\b(?:contract|contractor)\b', combined):
        detected.add("contract")
    if re.search(r'\bfreelance|freelancer\b', combined):
        detected.add("freelance")
    if re.search(r'\btemporary|temp\b', combined):
        detected.add("temporary")
    if re.search(r'\bintern(ship)?\b', combined):
        detected.add("internship")
    if re.search(r'\bseasonal\b', combined):
        detected.add("seasonal")
    if re.search(r'\bcommission\b', combined):
        detected.add("commission")

    return detected


def _passes_work_mode_filter(job: JobListing, combined_text: str, work_modes: list[str]) -> bool:
    allowed = {_normalize_filter_value(v) for v in work_modes if v}
    if not allowed:
        return True

    # Trust AI / structured metadata only — no regex fallback
    if job.work_mode_str:
        detected = {_normalize_filter_value(job.work_mode_str)}
        return bool(detected & allowed)

    # No work mode set by AI/structured — most jobs are onsite by default
    return "onsite" in allowed


def _passes_experience_filter_strict(job: JobListing, title_tokens: set[str], combined_tokens: set[str], experience: list[str]) -> bool:
    allowed = {_normalize_filter_value(v) for v in experience if v}
    if not allowed:
        return True

    # Trust AI / structured metadata only
    if job.experience_str:
        detected = _experience_categories(job.experience_str)
        if detected:
            return bool(detected & allowed)
        return False

    # No experience set by AI/structured — keep the job (don't assume level)
    return True


def _passes_job_type_filter_strict(job: JobListing, combined_text: str, job_types: list[str]) -> bool:
    allowed = {_normalize_filter_value(v) for v in job_types if v}
    if not allowed:
        return True

    # Trust AI / structured metadata only — no regex fallback
    if job.job_type_str:
        return _normalize_filter_value(job.job_type_str) in allowed

    # No job type set by AI/structured — most jobs are full-time by default
    return "full-time" in allowed


async def ai_filter_jobs(
    jobs: list[JobListing],
    query: str,
    location: Optional[LocationFilter] = None,
    work_modes: Optional[list[str]] = None,
    experience: Optional[list[str]] = None,
    job_types: Optional[list[str]] = None,
    salary_min: Optional[str] = None,
    date_posted: Optional[str] = None,
) -> list[JobListing]:
    """Deterministic semantic filtering engine — no LLM, no API limits."""
    if not jobs:
        return []

    q_raw, q_tokens, target_domains = ("", set(), set())
    if query:
        q_raw, q_tokens, target_domains = _resolve_target_domains(query)

    worldwide, allowed_country_terms, allowed_cities = _build_location_whitelist(location)

    parsed_salary_min = 0
    if salary_min:
        try:
            parsed_salary_min = int(str(salary_min).replace(",", "").replace(".", "").strip())
        except (ValueError, TypeError):
            pass

    valid_jobs = []

    for job in jobs:
        title_raw = (job.title or "").lower()
        title_tokens = tokenize(title_raw)
        combined_raw = _job_search_text(job).lower()
        combined_tokens = tokenize(combined_raw)

        # 1. Keyword / domain isolation
        if query and not _passes_keyword_filter(
            combined_raw,
            combined_tokens,
            title_tokens,
            q_raw,
            q_tokens,
            target_domains,
        ):
            continue

        # 2. Experience matching
        if experience:
            if not _passes_experience_filter_strict(job, title_tokens, combined_tokens, experience):
                continue

        # 3. Location whitelisting
        if not worldwide and location and location.values and (allowed_country_terms or allowed_cities):
            if not _passes_location_filter(job.location_str or "", worldwide, allowed_country_terms, allowed_cities):
                continue

        # 4. Work mode
        if work_modes and not _passes_work_mode_filter(job, combined_raw, work_modes):
            continue

        # 5. Date posted
        if date_posted and not _passes_date_filter(job.date_posted, date_posted):
            continue

        # 6. Salary filter
        if parsed_salary_min > 0:
            salary_text = job.salary_str or combined_raw
            if not _passes_salary_filter(salary_text, parsed_salary_min):
                continue

        # 7. Job type filter
        if job_types and not _passes_job_type_filter_strict(job, combined_raw, job_types):
            continue

        valid_jobs.append(job)

    print(f"[Semantic Filter] Kept {len(valid_jobs)} out of {len(jobs)} jobs (Query: {query})")
    return valid_jobs
