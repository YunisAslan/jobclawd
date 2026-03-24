"""
Deterministic Extraction Layer — NO AI.

Uses the full subsystem stack:
  1. Section parser → split text into weighted sections
  2. Keyword dictionaries → multilingual, weighted matching
  3. Regex patterns → salary, experience, email/URL patterns
  4. Negative rules → reject or downgrade false positives
  5. Conflict resolver → pick the best signal when sections disagree

Returns an ExtractionReport with per-field confidence scores.
"""

from __future__ import annotations

import re
from typing import Optional

from services.extraction.confidence import ExtractionReport, FieldResult
from services.extraction.keywords import (
    WORK_MODE_DICT, JOB_TYPE_DICT, SENIORITY_DICT, APPLY_METHOD_DICT,
    KeywordMatch,
)
from services.extraction.section_parser import (
    parse_sections, Section, apply_section_weight,
)
from services.extraction.negative_rules import apply_negative_rules
from services.extraction.conflict_resolver import resolve, ResolvedField

# Re-use existing proven regex extractors for salary/experience
from utils.job_meta_extractor import (
    extract_experience,
    extract_salary,
    extract_job_type,
    extract_work_mode,
)


# ── Skills Dictionary ──────────────────────────────────────────────

_SKILL_GROUPS: dict[str, list[str]] = {
    "languages": [
        "Python", "JavaScript", "TypeScript", "Java", "C#", "C\\+\\+", "Go",
        "Rust", "Ruby", "PHP", "Swift", "Kotlin", "Scala", "R\\b", "Dart",
        "Elixir", "Haskell", "Perl", "Lua", "MATLAB", "SQL", "HTML", "CSS",
        "Bash", "Shell", "PowerShell", "Objective-C",
    ],
    "frontend": [
        "React", "Vue\\.?js", "Angular", "Svelte", "Next\\.?js", "Nuxt\\.?js",
        "Tailwind", "Bootstrap", "jQuery", "Redux", "MobX", "Zustand",
        "Webpack", "Vite", "Storybook", "Sass", "SCSS", "Less",
    ],
    "backend": [
        "Node\\.?js", "Express", "FastAPI", "Django", "Flask", "Spring",
        "ASP\\.NET", "Rails", "Laravel", "NestJS", "Gin", "Fiber",
        "GraphQL", "REST", "gRPC", "WebSocket",
    ],
    "data": [
        "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch",
        "Cassandra", "DynamoDB", "SQLite", "Oracle", "SQL Server",
        "Snowflake", "BigQuery", "Redshift", "Kafka", "RabbitMQ",
        "Spark", "Hadoop", "Airflow", "dbt",
    ],
    "cloud_devops": [
        "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform",
        "Ansible", "Jenkins", "GitLab CI", "GitHub Actions", "CircleCI",
        "Datadog", "Grafana", "Prometheus", "Nginx", "Linux",
    ],
    "ml_ai": [
        "TensorFlow", "PyTorch", "scikit-learn", "Pandas", "NumPy",
        "Hugging Face", "LangChain", "OpenAI", "LLM", "NLP",
        "Computer Vision", "MLOps", "Jupyter",
    ],
    "mobile": [
        "React Native", "Flutter", "SwiftUI", "Jetpack Compose",
        "Xamarin", "Ionic", "Cordova",
    ],
    "tools": [
        "Git", "Jira", "Confluence", "Figma", "Postman",
        "Swagger", "OpenAPI", "Notion", "Slack",
    ],
}

_ALL_SKILLS: list[str] = []
for group_skills in _SKILL_GROUPS.values():
    _ALL_SKILLS.extend(group_skills)

_SKILL_PATTERN = re.compile(
    r'\b(' + '|'.join(_ALL_SKILLS) + r')\b',
    re.IGNORECASE,
)


def extract_skills(text: str) -> Optional[str]:
    if not text:
        return None
    matches = _SKILL_PATTERN.findall(text)
    if not matches:
        return None
    seen: set[str] = set()
    unique: list[str] = []
    for m in matches:
        key = m.lower().replace(".", "")
        if key not in seen:
            seen.add(key)
            unique.append(m)
    return ", ".join(unique[:30])


# ── Language Requirements ──────────────────────────────────────────

_LANGUAGE_PATTERNS = [
    re.compile(
        r'\b(English|Azerbaijani|Russian|Turkish|German|French|Spanish|Arabic|Chinese|'
        r'Italian|Portuguese|Japanese|Korean|Dutch|Swedish|Polish|Czech|Hindi|'
        r'İngiliscə|Azərbaycanca|Rusca|Türkcə|'
        r'английский|русский|турецкий|азербайджанский|немецкий|французский|'
        r'İngilizce|Almanca|Fransızca|Arapça)\b'
        r'(?:\s*[\(\-:]\s*'
        r'(native|fluent|advanced|intermediate|basic|conversational|proficient|'
        r'B1|B2|C1|C2|A1|A2|upper.?intermediate|'
        r'ana\s*dili?|sərbəst|orta|əla|yaxşı|родной|свободно?|хорошо?|средн)'
        r'[^\)]*\)?)?',
        re.IGNORECASE,
    ),
    re.compile(
        r'(?:fluent|proficient|advanced|native)\s+(?:in\s+)?'
        r'(English|Russian|Turkish|Azerbaijani|German|French|Spanish|Arabic)',
        re.IGNORECASE,
    ),
]

_LANG_REQUIRED = re.compile(
    r'(?:language|dil|язык|dil\s*bilgi)\s*(?:requirement|tələb|требовани|gereksinim)?\s*[:：]\s*'
    r'([\w\s,;/&]+?)(?:\.|$|\n)',
    re.IGNORECASE,
)


def extract_languages(text: str) -> Optional[str]:
    if not text:
        return None
    langs: list[str] = []
    for pattern in _LANGUAGE_PATTERNS:
        for m in pattern.finditer(text):
            lang = m.group(1).strip()
            level = ""
            try:
                level = (m.group(2) or "").strip()
            except IndexError:
                pass
            entry = f"{lang} ({level})" if level else lang
            if entry not in langs:
                langs.append(entry)
    m = _LANG_REQUIRED.search(text)
    if m:
        raw = m.group(1).strip()
        for part in re.split(r'[,;/&]', raw):
            part = part.strip()
            if part and len(part) < 40 and part not in langs:
                langs.append(part)
    return ", ".join(langs[:10]) if langs else None


# ── Work Authorization ────────────────────────────────────────────

_WORK_AUTH_PATTERNS = [
    (re.compile(r'\b(?:visa\s+sponsor(?:ship)?|sponsor\s+visa|work\s+permit\s+(?:provided|sponsored))\b', re.I), "visa_sponsored"),
    (re.compile(r'\b(?:no\s+(?:visa\s+)?sponsor(?:ship)?|(?:cannot|won\'t|will\s+not)\s+sponsor|must\s+(?:be\s+)?(?:authorized|eligible)\s+to\s+work|legally\s+authorized\s+to\s+work|work\s+authorization\s+required)\b', re.I), "no_sponsorship"),
    (re.compile(r'\b(?:citizen(?:ship)?\s+required|must\s+be\s+(?:a\s+)?(?:citizen|resident|permanent\s+resident)|only\s+(?:citizens|residents))\b', re.I), "citizen_required"),
    (re.compile(r'\b(?:open\s+to\s+all\s+(?:candidates|applicants)|no\s+(?:work\s+)?restriction|regardless\s+of\s+(?:nationality|citizenship))\b', re.I), "open"),
]


def extract_work_authorization(text: str) -> Optional[str]:
    if not text:
        return None
    for pattern, label in _WORK_AUTH_PATTERNS:
        if pattern.search(text):
            return label
    return None


# ── Apply Method Detection ────────────────────────────────────────

_EMAIL_APPLY_RE = re.compile(
    r'(?:send|submit|email|forward|attach).{0,40}(?:cv|resume|application)|'
    r'(?:cv|resume|application).{0,40}(?:send|submit|email|forward)|'
    r'göndər.{0,30}(?:cv|resume)|müraciət.{0,20}e-?mail|'
    r'apply\s+(?:via|by|through)\s+e?-?mail|'
    r'отправ.{0,20}(?:резюме|cv)|направ.{0,20}(?:резюме|cv)',
    re.IGNORECASE,
)

_EXTERNAL_APPLY_RE = re.compile(
    r'apply\s+(?:on|at|through|via)\s+(?:our|the|company)\s+(?:website|site|portal|page)|'
    r'apply\s+(?:here|directly)\s+(?:on|at)|click\s+(?:here|the\s+link)\s+to\s+apply|'
    r'visit\s+.{0,30}to\s+apply|application\s+(?:link|url|portal)|'
    r'müraciət\s+linki|подать\s+заявку\s+(?:на|через)',
    re.IGNORECASE,
)

_ATS_URL_PATTERNS = [
    (re.compile(r'boards\.greenhouse\.io|job-boards\.greenhouse\.io', re.I), "external", 0.95),
    (re.compile(r'jobs\.lever\.co', re.I), "external", 0.95),
    (re.compile(r'apply\.workable\.com', re.I), "external", 0.90),
    (re.compile(r'jobs\.smartrecruiters\.com', re.I), "external", 0.90),
    (re.compile(r'myworkdayjobs\.com|wd\d+\.myworkday', re.I), "external", 0.90),
    (re.compile(r'icims\.com', re.I), "external", 0.85),
    (re.compile(r'taleo\.net', re.I), "external", 0.85),
    (re.compile(r'jobvite\.com', re.I), "external", 0.85),
]


def detect_apply_method(
    *,
    source: str,
    url: str = "",
    description: str = "",
    hr_email: Optional[str] = None,
    apply_url: Optional[str] = None,
    card_data: Optional[dict] = None,
) -> FieldResult:
    """Rule-based apply method detection with confidence."""
    card = card_data or {}

    # Source-specific strong signals
    if source == "jobsearch":
        if hr_email:
            return FieldResult(value="email", confidence=0.95, method="rule",
                               evidence=f"HR email: {hr_email}")
        return FieldResult(value="direct", confidence=0.70, method="rule",
                           evidence="jobsearch.az default (no HR email)")

    if source == "linkedin":
        if card.get("has_easy_apply_badge") or card.get("applyMethod") == "easyApply":
            return FieldResult(value="easy_apply", confidence=0.95, method="structured",
                               evidence="LinkedIn Easy Apply badge")
        if apply_url:
            for pattern, method, conf in _ATS_URL_PATTERNS:
                if pattern.search(apply_url):
                    return FieldResult(value="external", confidence=conf, method="rule",
                                       evidence=f"ATS URL: {apply_url[:80]}")
        return FieldResult(value="external", confidence=0.70, method="rule",
                           evidence="LinkedIn without Easy Apply")

    if source == "indeed":
        if card.get("has_easily_apply") or card.get("has_indeed_apply"):
            return FieldResult(value="easy_apply", confidence=0.90, method="structured",
                               evidence="Indeed Easy Apply badge")
        return FieldResult(value="external", confidence=0.65, method="rule",
                           evidence="Indeed without Easy Apply")

    # Generic: check URL patterns
    if apply_url:
        for pattern, method, conf in _ATS_URL_PATTERNS:
            if pattern.search(apply_url):
                return FieldResult(value="external", confidence=conf, method="rule",
                                   evidence=f"ATS URL: {apply_url[:80]}")

    if url and "mailto:" in url.lower():
        return FieldResult(value="email", confidence=0.95, method="rule",
                           evidence="mailto: in URL")

    # Keyword dictionary on description
    if description:
        kw_match = APPLY_METHOD_DICT.best_match(description)
        if kw_match:
            return FieldResult(
                value=kw_match.canonical, confidence=0.75 * kw_match.weight,
                method="keyword", evidence=f"Matched: '{kw_match.matched_text}'",
            )

    # Regex fallback
    if description:
        if hr_email and _EMAIL_APPLY_RE.search(description):
            return FieldResult(value="email", confidence=0.85, method="regex",
                               evidence="Description mentions emailing CV + HR email present")
        if _EXTERNAL_APPLY_RE.search(description):
            return FieldResult(value="external", confidence=0.65, method="regex",
                               evidence="Description mentions external application")

    if hr_email:
        return FieldResult(value="email", confidence=0.75, method="rule",
                           evidence=f"HR email present: {hr_email}")

    return FieldResult(value="direct", confidence=0.30, method="default",
                       evidence="No apply method signals detected")


def classify_apply_complexity(
    apply_method: str,
    source: str,
    *,
    ats_platform: Optional[str] = None,
    easy_apply_tier: Optional[str] = None,
) -> tuple[str, str]:
    if apply_method == "email":
        return "easy", "full"
    if apply_method == "easy_apply":
        if easy_apply_tier == "A":
            return "easy", "full"
        if easy_apply_tier == "B":
            return "moderate", "assisted"
        return "hard", "manual"
    if apply_method == "external":
        simple_ats = {"greenhouse", "lever", "workable", "ashby", "breezy", "recruitee"}
        complex_ats = {"workday", "icims", "taleo"}
        if ats_platform in simple_ats:
            return "moderate", "assisted"
        if ats_platform in complex_ats:
            return "hard", "manual"
        return "hard", "manual"
    return "moderate", "manual"


# ══════════════════════════════════════════════════════════════════════
# SECTION-AWARE KEYWORD EXTRACTION
# ══════════════════════════════════════════════════════════════════════

def _extract_via_keywords(
    sections: list[Section],
    dictionary,
    field_name: str,
) -> FieldResult:
    """
    Run keyword matching across all sections, apply section weighting
    and negative rules, then resolve conflicts.
    """
    candidates: list[FieldResult] = []

    for section in sections:
        kw_match = dictionary.best_match(section.text)
        if kw_match:
            base_conf = 0.70 * kw_match.weight
            adjusted = apply_section_weight(base_conf, section.weight)
            fr = FieldResult(
                value=kw_match.canonical,
                confidence=round(adjusted, 3),
                method="keyword",
                evidence=f"[{section.name}] '{kw_match.matched_text}'",
            )
            # Run negative rules against section text
            fr = apply_negative_rules(field_name, fr, section.text)
            if not fr.is_empty:
                candidates.append(fr)

    if not candidates:
        return FieldResult()

    resolved = resolve(candidates)
    return resolved.result


def _extract_via_regex(
    sections: list[Section],
    regex_fn,
    field_name: str,
) -> FieldResult:
    """
    Run a regex-based extractor across all sections, with section weighting
    and negative rules.
    """
    candidates: list[FieldResult] = []

    for section in sections:
        val = regex_fn(section.text)
        if val:
            base_conf = 0.65
            adjusted = apply_section_weight(base_conf, section.weight)
            fr = FieldResult(
                value=val,
                confidence=round(adjusted, 3),
                method="regex",
                evidence=f"[{section.name}] {val}",
            )
            fr = apply_negative_rules(field_name, fr, section.text)
            if not fr.is_empty:
                candidates.append(fr)

    if not candidates:
        return FieldResult()

    resolved = resolve(candidates)
    return resolved.result


# ══════════════════════════════════════════════════════════════════════
# MAIN ENTRY POINT
# ══════════════════════════════════════════════════════════════════════

def extract_deterministic(
    *,
    title: str = "",
    company: str = "",
    description: str = "",
    url: str = "",
    source: str = "jobsearch",
    location_str: Optional[str] = None,
    hr_email: Optional[str] = None,
    apply_url: Optional[str] = None,
    card_data: Optional[dict] = None,
    structured_fields: Optional[dict] = None,
) -> ExtractionReport:
    """
    Full deterministic extraction pipeline:
      1. Parse text into weighted sections
      2. Run keyword dictionaries across sections
      3. Run regex extractors across sections
      4. Apply negative rules
      5. Resolve conflicts
      6. Fill from structured API fields (always wins)
      7. Detect apply method
    """
    report = ExtractionReport()
    struct = structured_fields or {}

    # ── Step 1: Parse into sections ──────────────────────────────────
    card_labels = None
    if card_data and isinstance(card_data, dict):
        labels = []
        for key in ("employment_type", "seniority_level", "work_mode", "job_type"):
            if card_data.get(key):
                labels.append(str(card_data[key]))
        card_labels = labels if labels else None

    sections = parse_sections(
        title=title,
        card_labels=card_labels,
        description=description,
    )

    # ── Step 2: Keyword-based extraction (multilingual, section-weighted) ──
    report.work_mode = _extract_via_keywords(sections, WORK_MODE_DICT, "work_mode")
    report.job_type = _extract_via_keywords(sections, JOB_TYPE_DICT, "job_type")
    report.experience = _extract_via_keywords(sections, SENIORITY_DICT, "seniority")

    # ── Step 3: Regex-based extraction (section-weighted) ──
    # Only fill if keywords didn't find anything
    if report.work_mode.is_empty:
        report.work_mode = _extract_via_regex(sections, extract_work_mode, "work_mode")

    if report.job_type.is_empty:
        report.job_type = _extract_via_regex(sections, extract_job_type, "job_type")

    # For experience: try regex which extracts "3+ years" style, merge with seniority keyword
    exp_regex = _extract_via_regex(sections, extract_experience, "experience")
    if exp_regex and not exp_regex.is_empty:
        # Merge: keyword seniority ("Senior") + regex years ("5+ years") → keep both
        if report.experience.is_empty:
            report.experience = exp_regex
        elif report.experience.confidence < exp_regex.confidence:
            report.experience = exp_regex

    # Salary always uses regex (keywords don't help here)
    report.salary = _extract_via_regex(sections, extract_salary, "salary")

    # ── Step 3.5: Work mode from location string ─────────────────
    # LinkedIn and other sources include "Remote", "Hybrid", "(Hybrid)" in
    # location_str. Extract work mode from it if nothing was found in text.
    if report.work_mode.is_empty and location_str:
        loc_wm = extract_work_mode(location_str)
        if loc_wm:
            report.work_mode = FieldResult(
                value=loc_wm, confidence=0.85, method="rule",
                evidence=f"Location string: {location_str}",
            )

    # ── Step 4: Structured API fields override (highest trust) ──────
    if struct.get("work_mode"):
        report.work_mode = FieldResult(value=struct["work_mode"], confidence=0.95,
                                       method="structured", evidence="Platform API field")
    if struct.get("job_type"):
        report.job_type = FieldResult(value=struct["job_type"], confidence=0.95,
                                      method="structured", evidence="Platform API field")
    if struct.get("salary"):
        report.salary = FieldResult(value=struct["salary"], confidence=0.95,
                                    method="structured", evidence="Platform API field")
    if struct.get("experience"):
        report.experience = FieldResult(value=struct["experience"], confidence=0.95,
                                        method="structured", evidence="Platform API field")
    if struct.get("location"):
        report.location = FieldResult(value=struct["location"], confidence=0.95,
                                      method="structured", evidence="Platform API field")

    # ── Step 5: Apply method detection ──────────────────────────────
    report.apply_method = detect_apply_method(
        source=source, url=url, description=description,
        hr_email=hr_email, apply_url=apply_url, card_data=card_data,
    )

    # ── Step 6: Skills extraction ───────────────────────────────────
    full_text = f"{title} {description}".strip()
    if full_text:
        skills = extract_skills(full_text)
        if skills:
            report.skills = FieldResult(
                value=skills, confidence=0.80, method="keyword",
                evidence=f"Found {len(skills.split(', '))} skills",
            )

    # ── Step 7: Language requirements ───────────────────────────────
    if full_text:
        langs = extract_languages(full_text)
        if langs:
            fr = FieldResult(value=langs, confidence=0.75, method="regex", evidence=langs)
            fr = apply_negative_rules("languages", fr, full_text)
            report.languages = fr

    # ── Step 8: Work authorization ──────────────────────────────────
    if full_text:
        auth = extract_work_authorization(full_text)
        if auth:
            report.work_authorization = FieldResult(
                value=auth, confidence=0.80, method="regex", evidence=auth,
            )

    # ── Step 9: Location fallback ───────────────────────────────────
    if report.location.is_empty and location_str:
        report.location = FieldResult(
            value=location_str, confidence=0.80, method="structured",
            evidence="Provided location",
        )

    # ── Step 10: Apply complexity ───────────────────────────────────
    if not report.apply_method.is_empty:
        complexity, auto_support = classify_apply_complexity(
            report.apply_method.value, source
        )
        report.apply_complexity = complexity
        report.auto_apply_support = auto_support

    return report
