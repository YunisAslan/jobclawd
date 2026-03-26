"""Indeed job scraper — non-fatal, returns [] on any error."""

import json
import re
from urllib.parse import quote_plus
from typing import Optional

from playwright_stealth import Stealth
from scraper import get_browser
from models.schemas import JobListing, JobSource, LocationFilter
from db.database import get_db
from services.ai_metadata_extractor import extract_metadata_ai_batch
from services.apply_method_detector import detect_from_indeed_card
from services.enrichment_service import fetch_metadata_for_urls
from utils.job_meta_extractor import extract_all as extract_meta
from utils.job_meta_extractor import primary_experience_value, split_experience_value

INDEED_BASE = "https://www.indeed.com"
_SYNC_DETAIL_ENRICH_LIMIT = 50

# ── Mosaic JSON extraction ──────────────────────────────────────────
_MOSAIC_RE = re.compile(
    r'window\.mosaic\.providerData\["mosaic-provider-jobcards"\]\s*=\s*(\{.+?\});\s*</script>',
    re.S,
)
_DATE_RE = re.compile(
    r'"jobkey"\s*:\s*"([^"]+)".*?"formattedRelativeTime"\s*:\s*"([^"]+)"'
)

_JOBTYPE_MAP = {
    "fulltime": "Full-time",
    "full-time": "Full-time",
    "parttime": "Part-time",
    "part-time": "Part-time",
    "contract": "Contract",
    "temporary": "Temporary",
    "internship": "Internship",
    "commission": "Commission",
}

_EXPLVL_MAP = {
    "entry_level": "Entry-level",
    "mid_level": "Mid-level",
    "senior_level": "Senior",
    "no_experience": "No experience",
}


def _taxonomy_attr_text(attr: dict) -> str:
    if not isinstance(attr, dict):
        return ""
    parts = []
    label = attr.get("label")
    if isinstance(label, str) and label.strip():
        parts.append(label.strip())
    for item in attr.get("attributes") or []:
        if not isinstance(item, dict):
            continue
        value = item.get("label") or item.get("value")
        if isinstance(value, str) and value.strip():
            parts.append(value.strip())
    return " ".join(parts)


def _has_missing_metadata(job: JobListing) -> bool:
    return not all([
        job.salary_str,
        job.job_type_str,
        primary_experience_value(job.seniority_str, job.experience_years_str) or job.experience_str,
        job.work_mode_str,
    ])


def _merge_missing_fields(job: JobListing, meta: dict) -> None:
    if not job.seniority_str and meta.get("seniority_str"):
        job.seniority_str = meta["seniority_str"]
        if meta.get("seniority_src"):
            job.seniority_src = meta["seniority_src"]
    if not job.experience_years_str and meta.get("experience_years_str"):
        job.experience_years_str = meta["experience_years_str"]
        if meta.get("experience_years_src"):
            job.experience_years_src = meta["experience_years_src"]
    if not job.salary_str and meta.get("salary_str"):
        job.salary_str = meta["salary_str"]
        if meta.get("salary_src"):
            job.salary_src = meta["salary_src"]
    if not job.job_type_str and meta.get("job_type_str"):
        job.job_type_str = meta["job_type_str"]
        if meta.get("job_type_src"):
            job.job_type_src = meta["job_type_src"]
    if not job.experience_str and meta.get("experience_str"):
        job.experience_str = meta["experience_str"]
        if meta.get("experience_src"):
            job.experience_src = meta["experience_src"]
    if not job.work_mode_str and meta.get("work_mode_str"):
        job.work_mode_str = meta["work_mode_str"]
        if meta.get("work_mode_src"):
            job.work_mode_src = meta["work_mode_src"]
    primary_experience = primary_experience_value(job.seniority_str, job.experience_years_str)
    if primary_experience and not job.experience_str:
        job.experience_str = primary_experience
        job.experience_src = job.seniority_src if job.seniority_str else job.experience_years_src


def _merge_missing_fields_with_source(job: JobListing, meta: dict, field_sources: dict, source: str) -> None:
    if not job.seniority_str and meta.get("seniority_str"):
        job.seniority_str = meta["seniority_str"]
        job.seniority_src = source
        field_sources["seniority_str"] = source
    if not job.experience_years_str and meta.get("experience_years_str"):
        job.experience_years_str = meta["experience_years_str"]
        job.experience_years_src = source
        field_sources["experience_years_str"] = source
    if not job.salary_str and meta.get("salary_str"):
        job.salary_str = meta["salary_str"]
        job.salary_src = source
        field_sources["salary_str"] = source
    if not job.job_type_str and meta.get("job_type_str"):
        job.job_type_str = meta["job_type_str"]
        job.job_type_src = source
        field_sources["job_type_str"] = source
    if not job.experience_str and meta.get("experience_str"):
        job.experience_str = meta["experience_str"]
        job.experience_src = source
        field_sources["experience_str"] = source
    if not job.work_mode_str and meta.get("work_mode_str"):
        job.work_mode_str = meta["work_mode_str"]
        job.work_mode_src = source
        field_sources["work_mode_str"] = source
    primary_experience = primary_experience_value(job.seniority_str, job.experience_years_str)
    if primary_experience and not job.experience_str:
        job.experience_str = primary_experience
        job.experience_src = job.seniority_src if job.seniority_str else job.experience_years_src
        field_sources["experience_str"] = source


def _log_meta_trace(job: JobListing, field_sources: dict, *, context: str) -> None:
    resolved = {
        "salary": field_sources.get("salary_str", "-"),
        "job_type": field_sources.get("job_type_str", "-"),
        "experience": field_sources.get("seniority_str", field_sources.get("experience_years_str", field_sources.get("experience_str", "-"))),
        "work_mode": field_sources.get("work_mode_str", "-"),
    }
    print(
        f"[MetaTrace][Indeed][{context}] "
        f"title={job.title[:60]!r} "
        f"salary={resolved['salary']} "
        f"job_type={resolved['job_type']} "
        f"experience={resolved['experience']} "
        f"work_mode={resolved['work_mode']}"
    )


def _parse_mosaic_results(html: str) -> dict[str, dict]:
    """Parse the mosaic JSON blob from page source."""
    meta_by_jk: dict[str, dict] = {}

    m = _MOSAIC_RE.search(html)
    if not m:
        for jk, rel_time in _DATE_RE.findall(html):
            meta_by_jk[jk] = {"date": rel_time}
        return meta_by_jk

    try:
        blob = json.loads(m.group(1))
    except (json.JSONDecodeError, TypeError):
        for jk, rel_time in _DATE_RE.findall(html):
            meta_by_jk[jk] = {"date": rel_time}
        return meta_by_jk

    results = []
    try:
        results = blob["metaData"]["mosaicProviderJobCardsModel"]["results"]
    except (KeyError, TypeError):
        pass
    if not results:
        try:
            results = blob.get("results", [])
        except (AttributeError, TypeError):
            pass

    for item in results:
        if not isinstance(item, dict):
            continue
        jk = item.get("jobkey") or ""
        if not jk:
            continue

        entry: dict = {}
        entry["date"] = item.get("formattedRelativeTime", "")

        # Salary
        sal = item.get("extractedSalary") or item.get("estimatedSalary") or {}
        if isinstance(sal, dict):
            s_min = sal.get("min")
            s_max = sal.get("max")
            s_type = sal.get("type", "")
            if s_min and s_max:
                period = ""
                if "year" in s_type:
                    period = "/yr"
                elif "month" in s_type:
                    period = "/mo"
                elif "hour" in s_type:
                    period = "/hr"
                entry["salary"] = f"${s_min:,.0f}-${s_max:,.0f}{period}"
            elif s_min:
                entry["salary"] = f"${s_min:,.0f}+"
        if not entry.get("salary"):
            sal_snippet = item.get("salarySnippet") or {}
            if isinstance(sal_snippet, dict):
                sal_text = sal_snippet.get("text") or sal_snippet.get("salaryTextFormatted")
                if sal_text:
                    entry["salary"] = str(sal_text).strip()
        if not entry.get("salary"):
            formatted = item.get("formattedSalary") or item.get("salary", "")
            if isinstance(formatted, str) and formatted.strip():
                entry["salary"] = formatted.strip()

        taxonomy = item.get("taxonomyAttributes") or []
        taxonomy_text = " | ".join(
            _taxonomy_attr_text(attr) for attr in taxonomy if _taxonomy_attr_text(attr)
        )

        # Job type
        job_types_raw = item.get("jobTypes") or []
        if isinstance(job_types_raw, list) and job_types_raw:
            jt = job_types_raw[0].lower().replace("_", "").replace("-", "")
            for code, label in _JOBTYPE_MAP.items():
                if code.replace("-", "") in jt:
                    entry["job_type"] = label
                    break
            if not entry.get("job_type"):
                entry["job_type"] = job_types_raw[0].replace("_", " ").title()

        if not entry.get("job_type"):
            for attr in taxonomy:
                if not isinstance(attr, dict):
                    continue
                label = (attr.get("label") or "").lower()
                if "job-type" in label or "job_type" in label or "jobtype" in label:
                    attrs = attr.get("attributes") or []
                    if attrs and isinstance(attrs[0], dict):
                        val = attrs[0].get("label") or attrs[0].get("value") or ""
                        if val:
                            normalized = val.lower().replace("-", "").replace("_", "").replace(" ", "")
                            for code, display_label in _JOBTYPE_MAP.items():
                                if code.replace("-", "") in normalized:
                                    entry["job_type"] = display_label
                                    break
                            if not entry.get("job_type"):
                                entry["job_type"] = val.replace("_", " ").title()

        # Experience level
        if not entry.get("experience"):
            for attr in taxonomy:
                if not isinstance(attr, dict):
                    continue
                label = (attr.get("label") or "").lower()
                if "experience" in label or "explvl" in label:
                    attrs = attr.get("attributes") or []
                    if attrs and isinstance(attrs[0], dict):
                        val = (attrs[0].get("label") or attrs[0].get("value") or "").lower()
                        for code, display_label in _EXPLVL_MAP.items():
                            if code in val.replace(" ", "_"):
                                entry["experience"] = display_label
                                break
                        if not entry.get("experience"):
                            entry["experience"] = val.replace("_", " ").title()

        # Work mode
        remote_loc = item.get("remoteLocation")
        if remote_loc:
            entry["work_mode"] = "Remote"
        else:
            for attr in taxonomy:
                if not isinstance(attr, dict):
                    continue
                label = (attr.get("label") or "").lower()
                if "remote" in label or "work-from-home" in label or "wfh" in label:
                    entry["work_mode"] = "Remote"
                    break
                if "hybrid" in label:
                    entry["work_mode"] = "Hybrid"
                    break

        # Regex fallback on mosaic snippet text
        if not all(entry.get(k) for k in ("salary", "job_type", "experience", "work_mode")):
            snippet_text = ""
            for snippet_key in ("snippet", "jobSnippet", "formattedSnippet", "description"):
                val = item.get(snippet_key)
                if isinstance(val, str) and len(val) > 20:
                    snippet_text = re.sub(r"<[^>]+>", " ", val)
                    break
                if isinstance(val, dict):
                    snippet_text = val.get("text", "") or val.get("html", "")
                    snippet_text = re.sub(r"<[^>]+>", " ", snippet_text)
                    break
            combined_text = " ".join(
                part for part in [
                    item.get("title", ""),
                    snippet_text,
                    taxonomy_text,
                    item.get("formattedRelativeTime", ""),
                ] if isinstance(part, str) and part.strip()
            ).strip()
            if combined_text:
                text_meta = extract_meta(combined_text)
                if not entry.get("salary"):
                    entry["salary"] = text_meta.get("salary_str")
                if not entry.get("job_type"):
                    entry["job_type"] = text_meta.get("job_type_str")
                if not entry.get("experience"):
                    entry["experience"] = text_meta.get("experience_str")
                if not entry.get("work_mode"):
                    entry["work_mode"] = text_meta.get("work_mode_str")

        meta_by_jk[jk] = entry

    return meta_by_jk


async def scrape_indeed(
    query: str,
    location: Optional[LocationFilter] = None,
    work_modes: Optional[list[str]] = None,
    experience: Optional[list[str]] = None,
    job_types: Optional[list[str]] = None,
    date_posted: Optional[str] = None,
    sort_by: Optional[str] = None,
) -> list[JobListing]:
    context = None
    try:
        browser = await get_browser()
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 720},
            locale="en-US",
            timezone_id="America/New_York",
            java_script_enabled=True,
        )

        page = await context.new_page()
        await Stealth().apply_stealth_async(page)

        encoded_q = quote_plus(query)
        target_location = ""

        if location and location.type in ["country", "city"]:
            val = None
            if location.values and len(location.values) > 0:
                val = location.values[0]
            elif location.value:
                val = location.value

            if val:
                if location.type == "country":
                    with get_db() as conn:
                        row = conn.execute(
                            "SELECT name FROM countries WHERE code = %s", (val,)
                        ).fetchone()
                        if row:
                            target_location = row["name"]
                elif location.type == "city":
                    with get_db() as conn:
                        row = conn.execute(
                            "SELECT name FROM cities WHERE value = %s", (val,)
                        ).fetchone()
                        if row:
                            target_location = row["name"]
                        else:
                            target_location = (
                                val.split("-")[1].title() if "-" in val else val.title()
                            )

        fromage = 0
        if date_posted in ("1d", "today", "past-24h"):
            fromage = 1
        elif date_posted in ("3d",):
            fromage = 3
        elif date_posted in ("7d", "past-week"):
            fromage = 7
        elif date_posted in ("1m", "past-month"):
            fromage = 30

        sc_tags = []
        if work_modes and "remote" in work_modes:
            sc_tags.append("attr(DSQF7)")

        if experience:
            if "junior" in experience or "freshmen" in experience or "intern" in experience:
                sc_tags.append("explvl(ENTRY_LEVEL)")
            elif "mid" in experience:
                sc_tags.append("explvl(MID_LEVEL)")
            elif "senior" in experience or "lead" in experience:
                sc_tags.append("explvl(SENIOR_LEVEL)")

        if job_types:
            if "full-time" in job_types:
                sc_tags.append("jobtype(fulltime)")
            elif "part-time" in job_types:
                sc_tags.append("jobtype(parttime)")
            elif "internship" in job_types:
                sc_tags.append("jobtype(internship)")

        sc_query = ""
        if sc_tags:
            sc_query = f"&sc=0kf:{''.join([f'{t};' for t in sc_tags])}"

        base_url = f"{INDEED_BASE}/jobs?q={encoded_q}"
        if target_location:
            base_url += f"&l={quote_plus(target_location)}"
        if fromage > 0:
            base_url += f"&fromage={fromage}"
        base_url += sc_query
        base_url += "&sort=date"

        jobs: list[JobListing] = []
        job_field_sources: list[dict[str, str]] = []
        seen_jks: set[str] = set()

        print(f"[Indeed] Search URL: {base_url}")

        for offset in range(0, 200, 10):
            url = f"{base_url}&start={offset}"
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_timeout(3000)

                # Check for Cloudflare challenge and wait if needed
                page_title = await page.title()
                if "moment" in page_title.lower() or "verify" in page_title.lower():
                    print(f"[Indeed] Cloudflare challenge detected, waiting...")
                    await page.wait_for_timeout(5000)
                    page_title = await page.title()

            except Exception as e:
                print(f"[Indeed] Navigation error at offset={offset}: {e}")
                break

            # Debug: log current URL and page title
            current_url = page.url
            title = await page.title()
            print(f"[Indeed] Page offset={offset} url={current_url} title={title!r}")

            cards = await page.query_selector_all(".job_seen_beacon")
            if not cards:
                cards = await page.query_selector_all(".result")
            if not cards:
                # Debug: check if Indeed is showing a captcha or redirect
                body_text = await page.inner_text("body")
                snippet = body_text[:300].replace("\n", " ")
                print(f"[Indeed] No cards at offset={offset}. Body: {snippet}")
                break

            html_content = await page.content()
            mosaic_meta = _parse_mosaic_results(html_content)

            for card in cards:
                try:
                    jk_el = await card.query_selector("[data-jk]")
                    jk = await jk_el.get_attribute("data-jk") if jk_el else None
                    if not jk or jk in seen_jks:
                        continue

                    title_el = await card.query_selector('[data-testid="jobTitle"] span')
                    if not title_el:
                        title_el = await card.query_selector("h2.jobTitle span")

                    company_el = await card.query_selector('[data-testid="company-name"]')
                    location_el = await card.query_selector('[data-testid="text-location"]')

                    title = ""
                    if title_el:
                        title = (await title_el.inner_text()).strip()
                        if not title:
                            title = await title_el.get_attribute("title")
                    else:
                        title_el = await card.query_selector("h2.jobTitle")
                        if title_el:
                            title = (await title_el.inner_text()).strip()

                    company = (await company_el.inner_text()).strip() if company_el else ""
                    location_str = (
                        (await location_el.inner_text()).strip() if location_el else ""
                    )

                    snippet = ""
                    try:
                        snippet_el = await card.query_selector(
                            '[data-testid="job-snippet"]'
                        )
                        if not snippet_el:
                            snippet_el = await card.query_selector(".job-snippet")
                        if snippet_el:
                            snippet = (await snippet_el.inner_text()).strip()[:500]
                    except Exception:
                        pass

                    logo_url = None

                    if not title:
                        continue

                    seen_jks.add(jk)

                    # ── Get structured metadata from mosaic JSON ──
                    jk_meta = mosaic_meta.get(jk, {})
                    date_str = jk_meta.get("date", "")
                    salary_str = jk_meta.get("salary")
                    job_type_str = jk_meta.get("job_type")
                    experience_str = jk_meta.get("experience")
                    seniority_str, experience_years_str = split_experience_value(experience_str)
                    work_mode_str = jk_meta.get("work_mode")
                    field_sources: dict[str, str] = {}
                    if salary_str:
                        field_sources["salary_str"] = "structured"
                    if job_type_str:
                        field_sources["job_type_str"] = "structured"
                    if seniority_str:
                        field_sources["seniority_str"] = "structured"
                    if experience_years_str:
                        field_sources["experience_years_str"] = "structured"
                    if experience_str:
                        field_sources["experience_str"] = "structured"
                    if work_mode_str:
                        field_sources["work_mode_str"] = "structured"

                    # ── DOM fallback: salary element ──
                    if not salary_str:
                        try:
                            sal_el = await card.query_selector(
                                '[data-testid="attribute_snippet_testid"], '
                                ".salary-snippet-container, "
                                ".metadata.salary-snippet-container, "
                                ".salaryOnly"
                            )
                            if sal_el:
                                sal_text = (await sal_el.inner_text()).strip()
                                if sal_text:
                                    salary_str = sal_text
                                    field_sources["salary_str"] = "structured"
                        except Exception:
                            pass

                    # ── DOM fallback: metadata tags ──
                    if not job_type_str or not work_mode_str:
                        try:
                            metadata_els = await card.query_selector_all(
                                ".metadata div, "
                                '[data-testid="attribute_snippet_testid"], '
                                ".jobMetaDataGroup span, "
                                '[data-testid="attribute_snippet_testid"] *, '
                                '[data-testid="features"] *'
                            )
                            for mel in metadata_els:
                                mel_text = (await mel.inner_text()).strip().lower()
                                if not job_type_str:
                                    for code, label in _JOBTYPE_MAP.items():
                                        if code.replace("-", "") in mel_text.replace(
                                            "-", ""
                                        ).replace(" ", ""):
                                            job_type_str = label
                                            field_sources["job_type_str"] = "structured"
                                            break
                                if not work_mode_str:
                                    if "remote" in mel_text:
                                        work_mode_str = "Remote"
                                        field_sources["work_mode_str"] = "structured"
                                    elif "hybrid" in mel_text:
                                        work_mode_str = "Hybrid"
                                        field_sources["work_mode_str"] = "structured"
                        except Exception:
                            pass

                    # ── Regex fallback on card text — salary only ──
                    # Experience, job_type, work_mode are handled by AI.
                    # Regex keyword matching causes false positives.
                    if not salary_str:
                        try:
                            full_card_text = (await card.inner_text()).strip()
                        except Exception:
                            full_card_text = f"{title} {location_str} {snippet}"
                        text_meta = extract_meta(full_card_text)
                        if text_meta.get("salary_str"):
                            salary_str = text_meta["salary_str"]
                            field_sources["salary_str"] = "fallback"

                    # ── Apply method detection ──
                    has_easily_apply = False
                    has_indeed_apply = False
                    try:
                        ea_el = await card.query_selector(
                            '.ialbl, [class*="easily"], '
                            '.iaLabel, [data-testid="indeedApply"], '
                            ".indeed-apply-badge"
                        )
                        if ea_el:
                            has_easily_apply = True
                        ia_el = await card.query_selector(
                            "[data-indeed-apply-button], [data-indeedApply]"
                        )
                        if ia_el:
                            has_indeed_apply = True
                        if not has_easily_apply and not has_indeed_apply:
                            card_text = (await card.inner_text()).lower()
                            if (
                                "easily apply" in card_text
                                or "indeed apply" in card_text
                            ):
                                has_easily_apply = True
                    except Exception:
                        pass

                    apply_method = detect_from_indeed_card(
                        {
                            "has_easily_apply": has_easily_apply,
                            "has_indeed_apply": has_indeed_apply,
                        }
                    )

                    job_url = f"{INDEED_BASE}/viewjob?jk={jk}"
                    jobs.append(
                        JobListing(
                            title=title,
                            company=company,
                            url=job_url,
                            date_posted=date_str,
                            source=JobSource.indeed,
                            location_str=location_str,
                            logo_url=logo_url,
                            description_snippet=snippet or None,
                            apply_method=apply_method,
                            seniority_str=seniority_str,
                            seniority_src=field_sources.get("seniority_str"),
                            experience_years_str=experience_years_str,
                            experience_years_src=field_sources.get("experience_years_str"),
                            experience_str=experience_str,
                            experience_src=field_sources.get("experience_str"),
                            job_type_str=job_type_str,
                            job_type_src=field_sources.get("job_type_str"),
                            salary_str=salary_str,
                            salary_src=field_sources.get("salary_str"),
                            work_mode_str=work_mode_str,
                            work_mode_src=field_sources.get("work_mode_str"),
                        )
                    )
                    jobs[-1].__dict__["_card_data"] = {
                        "labels": [
                            value
                            for value in (job_type_str, seniority_str, experience_years_str, work_mode_str)
                            if value
                        ],
                        "card_badges": [
                            value
                            for value in (job_type_str, seniority_str, experience_years_str, work_mode_str)
                            if value
                        ],
                        "employment_type": job_type_str,
                        "seniority_level": seniority_str,
                        "experience_years": experience_years_str,
                        "workplace_type": work_mode_str,
                        "has_indeed_apply": has_indeed_apply,
                    }
                    job_field_sources.append(field_sources)
                except Exception:
                    continue

            if len(jobs) >= 200:
                break

        print(f"[Indeed] Fetched {len(jobs)} jobs for '{query}' @ {target_location}")

        # ── Step 1: AI extraction on card text for remaining gaps ──
        # AI can infer experience from title ("Senior"), work mode from
        # location ("Remote"), job type from context.
        ai_candidates = []
        ai_index_map: dict[str, int] = {}
        for idx, job in enumerate(jobs):
            if not _has_missing_metadata(job):
                continue
            item_id = str(idx)
            ai_index_map[item_id] = idx
            ai_candidates.append(
                {
                    "id": item_id,
                    "title": job.title,
                    "company": job.company,
                    "location_str": job.location_str or "",
                    "snippet": job.description_snippet or "",
                    "detail_text": "",
                }
            )

        if ai_candidates:
            print(f"[Indeed] AI extracting from {len(ai_candidates)} card titles...")
            try:
                ai_results = await extract_metadata_ai_batch(
                    ai_candidates,
                    source="indeed",
                    context="search-card",
                )
                for item_id, meta in ai_results.items():
                    idx = ai_index_map.get(item_id)
                    if idx is None:
                        continue
                    _merge_missing_fields_with_source(
                        jobs[idx], meta, job_field_sources[idx], "openai"
                    )
            except Exception as e:
                print(f"[Indeed] AI card extraction error: {e}")

        # ── Step 2: Detail-page enrichment for remaining gaps ──
        # Salary is rarely in card text — detail pages have it.
        detail_candidates = [
            (idx, job.url)
            for idx, job in enumerate(jobs)
            if _has_missing_metadata(job)
        ][:_SYNC_DETAIL_ENRICH_LIMIT]

        if detail_candidates:
            print(f"[Indeed] Enriching {len(detail_candidates)} jobs via detail pages...")
            try:
                detail_results = await fetch_metadata_for_urls(
                    [url for _, url in detail_candidates]
                )
                for idx, url in detail_candidates:
                    meta = detail_results.get(url)
                    if not meta:
                        continue
                    _merge_missing_fields(jobs[idx], meta)
                    src = job_field_sources[idx]
                    for field, src_field in [
                        ("seniority_str", "seniority_src"),
                        ("experience_years_str", "experience_years_src"),
                    ]:
                        if meta.get(field) and not src.get(field):
                            src[field] = meta.get(src_field, "detail-page")
                    for field, src_field in [
                        ("salary_str", "salary_src"),
                        ("job_type_str", "job_type_src"),
                        ("experience_str", "experience_src"),
                        ("work_mode_str", "work_mode_src"),
                    ]:
                        if meta.get(field) and not src.get(field):
                            src[field] = meta.get(src_field, "detail-page")
            except Exception as e:
                print(f"[Indeed] Detail enrichment error: {e}")

        for idx, job in enumerate(jobs):
            _log_meta_trace(
                job,
                job_field_sources[idx] if idx < len(job_field_sources) else {},
                context="search-card",
            )

        return jobs

    except Exception:
        return []
    finally:
        try:
            if context:
                await context.close()
        except Exception:
            pass
