import re
from datetime import datetime, timedelta
from typing import Optional
import pycountry
from models.schemas import JobListing, LocationFilter


def _pycountry_terms(iso2: str) -> set[str]:
    """Return all ISO 3166-1 name variants for a country (name, official_name, common_name)."""
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
    """Extracts lowercase alphanumeric words from text."""
    if not text:
        return set()
    return set(re.findall(r"[a-z0-9]+", text.lower()))


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
    """
    Replaces unreliable LLM filtering with a fast, deterministic semantic heuristic engine.
    This guarantees 0 API limits, instant filtering, and completely predictable results
    that strictly behave according to user input.
    """
    if not jobs:
        return []

    # Map well-known domains to avoid cross-pollination.
    # Ex: if user searches "frontend", we strictly reject "QA" unless frontend is also mentioned.
    domains = {
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

    q_tokens = set()
    q_raw = ""
    target_domains = set()

    if query:
        q_raw = query.lower()
        q_tokens = tokenize(query)
        # Determine if the query maps to any known domains
        for dom, keywords in domains.items():
            if dom in q_tokens or any(k in q_tokens for k in keywords):
                target_domains.add(dom)
        
        # If no strict domain hit, but the raw query contains the domain name
        if not target_domains:
            for dom in domains:
                if dom in q_raw:
                    target_domains.add(dom)

    # ---------------------------------------------------------
    # 0. DYNAMIC LOCATION WHITELIST FROM DATABASE + pycountry
    # ---------------------------------------------------------
    # Strategy:
    #   - DB (countriesnow.space): provides common country names ("Russia", "Germany") and all city names
    #   - pycountry (ISO 3166-1): provides official/alternate names ("Russian Federation")
    #   Together they cover all 249 countries without any manual alias map.

    worldwide = False
    allowed_country_terms = set()
    allowed_cities = set()

    if location and location.values:
        if "worldwide" in location.values:
            worldwide = True
        else:
            from db.database import get_db
            try:
                with get_db() as conn:
                    for val in location.values:
                        c_code = None

                        # Is it a country code?
                        crow = conn.execute("SELECT name, code FROM countries WHERE code = ?", (val,)).fetchone()
                        if crow:
                            allowed_country_terms.add(crow["name"].lower())
                            c_code = crow["code"]

                        # Is it a city slug (e.g. "ru-moscow")?
                        city_row = conn.execute("SELECT name, country_code FROM cities WHERE value = ?", (val,)).fetchone()
                        if city_row:
                            allowed_cities.add(city_row["name"].lower())
                            c_code = city_row["country_code"]
                            c_row2 = conn.execute("SELECT name FROM countries WHERE code = ?", (c_code,)).fetchone()
                            if c_row2:
                                allowed_country_terms.add(c_row2["name"].lower())

                        if c_code:
                            # Add ISO 3166-1 name variants for the country (covers "Russian Federation",
                            # "United States of America", common_name where defined, etc.)
                            allowed_country_terms.update(_pycountry_terms(c_code))

                            # Load ALL cities for that country so city-only location strings
                            # (e.g. "Munich" for a Germany search) pass immediately — O(1) set lookup.
                            all_cities = conn.execute(
                                "SELECT name FROM cities WHERE country_code = ?", (c_code,)
                            ).fetchall()
                            for ac in all_cities:
                                allowed_cities.add(ac["name"].lower())

            except Exception as e:
                print(f"[AIFilter] DB Location fetch error: {e}")

            # Fallback: DB not seeded yet — use pycountry directly so the filter
            # is never silently bypassed regardless of DB state.
            if not allowed_country_terms and not allowed_cities:
                for val in location.values:
                    terms = _pycountry_terms(val)
                    if terms:
                        allowed_country_terms.update(terms)
                    else:
                        # City slug (e.g. "ru-moscow") — extract the city part as a best-effort term
                        raw = val.lower()
                        if "-" in raw:
                            raw = raw.split("-", 1)[1]
                        if raw:
                            allowed_country_terms.add(raw)

    valid_jobs = []

    for job in jobs:
        title_raw = (job.title or "").lower()
        title_tokens = tokenize(title_raw)

        # ---------------------------------------------------------
        # 1. STRICT KEYWORD / DOMAIN ISOLATION
        # ---------------------------------------------------------
        if query:
            violated = False

            # If we know the user is looking for a specific domain(s)...
            if target_domains:
                # First, ensure the title has at least ONE word from the target domain(s), 
                # OR overlaps directly with the user's manual query search text.
                has_target_keyword = False
                for dom in target_domains:
                    if any(k in title_tokens for k in domains[dom]):
                        has_target_keyword = True
                        break
                
                if not has_target_keyword and not (q_tokens & title_tokens) and q_raw not in title_raw:
                    # No connection whatsoever to the requested domain.
                    continue

                # Next, ensure it isn't explicitly a DIFFERENT domain masquerading in the search.
                # (e.g. searching 'frontend' and getting 'PHP backend' because the scraper was loose)
                for dom, keywords in domains.items():
                    if dom not in target_domains:
                        # If the title contains strong keywords for a disjoint domain
                        if any(k in title_tokens for k in keywords):
                            conflicting_domain = dom
                            # If it contains a conflicting domain (like 'qa'), we ONLY allow it 
                            # if the title also explicitly contains our exact target domain name (e.g. 'frontend').
                            # Just having a shared skill (like 'javascript') is NOT enough to override 'qa'.
                            if not any(d in title_tokens for d in target_domains):
                                violated = True
                                break
            
            else:
                # If query isn't in our mapped domains (e.g., "Accountant", "Driver"),
                # we do a simple strict intersection.
                if not (q_tokens & title_tokens) and q_raw not in title_raw:
                    violated = True

            if violated:
                continue

        # ---------------------------------------------------------
        # 2. STRICT EXPERIENCE MATCHING
        # ---------------------------------------------------------
        if experience:
            snippet_tokens = tokenize(job.description_snippet or "")
            title_snippet_tokens = title_tokens | snippet_tokens

            senior_words = {"senior", "lead", "head", "director", "principal", "manager", "expert", "sr"}
            junior_entry_words = {"intern", "internship", "trainee", "graduate", "fresher", "freshmen", "stajyer", "entry"}

            # Reject explicitly senior titles when user wants entry-level
            is_entry_search = any(e in ["intern", "junior", "freshmen"] for e in experience)
            if is_entry_search:
                if title_tokens & senior_words:
                    continue

            # When user selects ONLY "intern" (without also junior/mid/senior/lead),
            # require at least one positive intern signal in title or snippet.
            if "intern" in experience and not any(e in ["junior", "mid", "senior", "lead"] for e in experience):
                if not (title_snippet_tokens & junior_entry_words):
                    continue  # No intern/trainee/graduate signal found → skip

            # If user explicitly wants Senior Level
            is_senior_search = any(e in ["senior", "lead"] for e in experience)
            if is_senior_search:
                if title_tokens & junior_entry_words:
                    continue  # Reject intern/trainee jobs masquerading as senior searches

        # ---------------------------------------------------------
        # 3. DYNAMIC LOCATION WHITELISTING
        # ---------------------------------------------------------
        if not worldwide and location and location.values and (allowed_country_terms or allowed_cities):
            loc_lower = (job.location_str or "").lower().strip()

            if not loc_lower:
                # No location info on this job — drop it to avoid false positives
                # (e.g., an Indeed job with a missing location_str element)
                continue

            is_valid = False

            # Check country terms using simple substring logic to catch "Türkiye" inside "Istanbul, Türkiye"
            for term in allowed_country_terms:
                if term in loc_lower:
                    is_valid = True
                    break

            if not is_valid:
                # Tokenize the job's location string to check against DB cities O(1)
                # We regex split to avoid punctuation messing up the match (e.g. "Karlsruhe," -> "karlsruhe")
                loc_tokens = set(re.split(r'[^a-z0-9äöüßçğışə]+', loc_lower)) - {""}

                if loc_tokens & allowed_cities:
                    is_valid = True

                # Also permit explicit "remote" if it doesn't specify a foreign country.
                # e.g., "Remote" is fine, but "Remote, New York" will fail unless user allows USA.
                if not is_valid and "remote" in loc_lower:
                    # Only permit generic remote strings. If it contains too many extra tokens, it's likely a specific remote foreign location.
                    if len(loc_tokens) <= 3:
                        is_valid = True

            if not is_valid:
                continue  # Drop jobs from unmatched regions (e.g. New York, India)

        # --- 4. Enforce strict Date Posted filtering ---
        if date_posted and date_posted not in ["all", "any"]:
            if job.date_posted:
                try:
                    raw = job.date_posted.strip()
                    job_dt: Optional[datetime] = None

                    # Try ISO format first (JobSearch returns "2026-03-03T00:00:00+04:00")
                    try:
                        job_dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                        # Normalize to UTC naive
                        if job_dt.tzinfo is not None:
                            from datetime import timezone as _tz
                            job_dt = job_dt.astimezone(_tz.utc).replace(tzinfo=None)
                    except ValueError:
                        pass

                    # Fallback: parse relative strings like "3 days ago", "10 hours ago" (Indeed)
                    if job_dt is None:
                        import re as _re
                        m = _re.search(r"(\d+)\s*(hour|day|week|minute)", raw, _re.I)
                        if m:
                            amount = int(m.group(1))
                            unit = m.group(2).lower()
                            delta = {"hour": timedelta(hours=amount), "minute": timedelta(minutes=amount),
                                     "day": timedelta(days=amount), "week": timedelta(weeks=amount)}.get(unit)
                            if delta:
                                job_dt = datetime.utcnow() - delta

                    if job_dt is not None:
                        # Normalize now to start of current day for inclusive "days" logic
                        now_utc = datetime.utcnow()
                        # Use a 1-day buffer or just round job_dt
                        diff = now_utc - job_dt
                        
                        # Use slightly more lenient diffs (e.g. 1.2 days for "1d") to handle calendar days better
                        if date_posted in ("1d", "today", "past-24h"):
                            if diff > timedelta(days=1, hours=4): continue
                        elif date_posted in ("3d",):
                            if diff > timedelta(days=3, hours=4): continue
                        elif date_posted in ("7d", "past-week"):
                            if diff > timedelta(days=7, hours=4): continue
                        elif date_posted in ("1m", "past-month"):
                            if diff > timedelta(days=31, hours=4): continue
                except Exception as e:
                    print(f"[DateFilter] Skipped date check for '{job.date_posted}': {e}")

        # ---------------------------------------------------------
        # 5. SALARY FILTER — best-effort via title + snippet
        # Only fires when a salary is explicitly mentioned. Jobs with no salary
        # info are kept (no false negatives). Ranges like "30-50k" use the MAX
        # value — if the top of the range meets the minimum, keep the job.
        # ---------------------------------------------------------
        if salary_min:
            try:
                annual_min = int(str(salary_min).replace(",", "").replace(".", "").strip())
                if annual_min > 0:
                    import re as _re
                    title_check = (job.title or "").lower()
                    snippet_check = (job.description_snippet or "").lower()
                    combined_check = f"{title_check} {snippet_check}"

                    found_salary = False
                    passes_salary = True

                    # --- RANGES FIRST (must come before single-value patterns) ---

                    # Range k–k: "$30k-$50k", "30k - 50k", "30K–50K"
                    m = _re.search(
                        r"[\$£€]?\s*\d+(?:\.\d+)?\s*k\s*[-–]\s*[\$£€]?\s*(\d+(?:\.\d+)?)\s*k",
                        combined_check,
                    )
                    if m:
                        found_salary = True
                        if float(m.group(1)) * 1000 < annual_min:
                            passes_salary = False

                    # Range plain–k: "30-50k", "30 – 50k"
                    if not found_salary:
                        m = _re.search(
                            r"[\$£€]?\s*\d+\s*[-–]\s*[\$£€]?\s*(\d+(?:\.\d+)?)\s*k",
                            combined_check,
                        )
                        if m:
                            found_salary = True
                            if float(m.group(1)) * 1000 < annual_min:
                                passes_salary = False

                    # Range explicit: "$30,000 - $50,000", "30000–50000"
                    if not found_salary:
                        m = _re.search(
                            r"[\$£€]?\s*\d{2,3}(?:[.,]\d{3})+\s*[-–]\s*[\$£€]?\s*(\d{2,3}(?:[.,]\d{3})+)",
                            combined_check,
                        )
                        if m:
                            found_salary = True
                            raw2 = m.group(1).replace(",", "").replace(".", "")
                            try:
                                max_amount = int(raw2)
                                if max_amount >= 1000 and max_amount < annual_min:
                                    passes_salary = False
                            except ValueError:
                                pass

                    # --- SINGLE VALUES ---

                    # Hourly: "$40/hr", "40/hour", "£25 per hr"
                    if not found_salary:
                        m = _re.search(
                            r"[\$£€]?\s*(\d+(?:[.,]\d+)?)\s*(?:/\s*h(?:r|our)?|per\s*h(?:r|our))",
                            combined_check,
                        )
                        if m:
                            found_salary = True
                            rate = float(m.group(1).replace(",", "."))
                            if (rate * 2080) < annual_min:
                                passes_salary = False

                    # Annual k: "$80k", "80K/yr" (not preceded by a range dash)
                    if not found_salary:
                        m = _re.search(
                            r"[\$£€]?\s*(\d+(?:\.\d+)?)\s*k(?:/yr)?",
                            combined_check,
                        )
                        if m:
                            found_salary = True
                            if float(m.group(1)) * 1000 < annual_min:
                                passes_salary = False

                    # Explicit annual: "$120,000", "120 000 USD"
                    if not found_salary:
                        m = _re.search(
                            r"[\$£€]?\s*(\d{2,3}(?:[.,]\d{3})+)(?:\s*/\s*yr|\s*(?:usd|eur|gbp|cad|aud))?",
                            combined_check,
                        )
                        if m:
                            found_salary = True
                            raw = m.group(1).replace(",", "").replace(".", "")
                            try:
                                amount = int(raw)
                                if amount >= 1000 and amount < annual_min:
                                    passes_salary = False
                            except ValueError:
                                pass

                    if found_salary and not passes_salary:
                        continue
            except (ValueError, TypeError):
                pass

        # ---------------------------------------------------------
        # 6. JOB TYPE FILTER — title + snippet signals
        # Only rejects if the job explicitly signals a type the user excluded.
        # Jobs with no type signal are always kept.
        # ---------------------------------------------------------
        if job_types:
            type_check = f"{(job.title or '').lower()} {(job.description_snippet or '').lower()}"
            is_contract = bool(re.search(r'\b(contract|contractor|freelance|freelancer|temporary|temp)\b', type_check))
            is_parttime = bool(re.search(r'\bpart[\s\-]?time\b|\bp/t\b', type_check))

            wants_contract = "contract" in job_types
            wants_parttime = "part-time" in job_types

            if is_contract and not wants_contract:
                continue
            if is_parttime and not wants_parttime:
                continue

        # If it passed all strict semantic checks, it's a valid match!
        valid_jobs.append(job)

    print(f"[Semantic Filter] Kept {len(valid_jobs)} out of {len(jobs)} jobs (Query: {query})")
    return valid_jobs
