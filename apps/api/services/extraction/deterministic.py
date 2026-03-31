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

from services.extraction.canonical import build_canonical_vacancy_signals
from services.extraction.confidence import ExtractionReport, FieldResult
from services.extraction.keywords import (
    WORK_MODE_DICT, JOB_TYPE_DICT, SENIORITY_DICT,
    KeywordMatch,
)
from services.extraction.section_parser import (
    parse_sections, Section, apply_section_weight,
)
from services.extraction.negative_rules import apply_negative_rules
from services.extraction.conflict_resolver import resolve, ResolvedField

# Re-use existing proven regex extractors for salary/experience
from utils.job_meta_extractor import (
    extract_experience_years,
    extract_salary,
    extract_seniority,
    extract_job_type,
    extract_work_mode,
    normalize_job_type,
    normalize_seniority,
    normalize_work_mode,
)


# ── Skills Dictionary ──────────────────────────────────────────────

_SKILL_GROUPS: dict[str, list[str]] = {
    "languages": [
        "Python", "JavaScript", "TypeScript", "Java", "C#", "C\\+\\+", "Go",
        "Rust", "Ruby", "PHP", "Swift", "Kotlin", "Scala", "R\\b", "Dart",
        "Elixir", "Haskell", "Perl", "Lua", "MATLAB", "SQL", "HTML", "CSS",
        "Bash", "Shell", "PowerShell", "Objective-C", "Clojure", "Erlang",
        "F#", "OCaml", "Groovy", "Assembly", "COBOL", "Fortran",
        "Solidity", "Zig", "V\\b", "Nim", "Julia",
    ],
    "frontend": [
        "React", "Vue\\.?js", "Angular", "Svelte", "Next\\.?js", "Nuxt\\.?js",
        "Tailwind", "Bootstrap", "jQuery", "Redux", "MobX", "Zustand",
        "Webpack", "Vite", "Storybook", "Sass", "SCSS", "Less",
        "Remix", "Gatsby", "Astro", "SolidJS", "Qwik", "Alpine\\.?js",
        "Ember", "Backbone", "D3\\.?js", "Three\\.?js", "Chart\\.?js",
        "Material UI", "Ant Design", "Chakra UI", "Radix", "shadcn",
        "Framer Motion", "CSS Modules", "Styled Components",
    ],
    "backend": [
        "Node\\.?js", "Express", "FastAPI", "Django", "Flask", "Spring",
        "ASP\\.NET", "Rails", "Laravel", "NestJS", "Gin", "Fiber",
        "GraphQL", "REST", "gRPC", "WebSocket",
        "Spring Boot", "Koa", "Hapi", "Actix", "Axum", "Rocket",
        "Phoenix", "Sinatra", "Symfony", "CodeIgniter",
        "Thrift", "Baseplate", "Tornado", "aiohttp", "Celery",
    ],
    "data": [
        "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch",
        "Cassandra", "DynamoDB", "SQLite", "Oracle", "SQL Server",
        "Snowflake", "BigQuery", "Redshift", "Kafka", "RabbitMQ",
        "Spark", "Hadoop", "Airflow", "dbt",
        "ClickHouse", "Neo4j", "CockroachDB", "TimescaleDB", "InfluxDB",
        "Druid", "Presto", "Trino", "Flink", "Pulsar", "NATS",
        "Hive", "Delta Lake", "Iceberg", "Parquet", "Avro",
        "Databricks", "Fivetran", "Airbyte", "Dagster", "Prefect",
        "MariaDB", "Memcached", "Couchbase", "Firebase",
    ],
    "cloud_devops": [
        "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform",
        "Ansible", "Jenkins", "GitLab CI", "GitHub Actions", "CircleCI",
        "Datadog", "Grafana", "Prometheus", "Nginx", "Linux",
        "Pulumi", "CloudFormation", "CDK", "Vagrant", "Packer",
        "ArgoCD", "Argo", "Helm", "Istio", "Envoy", "Consul",
        "Vault", "Chef", "Puppet", "SaltStack",
        "New Relic", "Splunk", "ELK", "Kibana", "Logstash",
        "PagerDuty", "OpsGenie", "CloudWatch", "Sentry",
        "Vercel", "Netlify", "Heroku", "Railway", "Fly\\.io",
        "DigitalOcean", "Linode", "Cloudflare",
    ],
    "ml_ai": [
        "TensorFlow", "PyTorch", "scikit-learn", "Pandas", "NumPy",
        "Hugging Face", "LangChain", "OpenAI", "LLM", "NLP",
        "Computer Vision", "MLOps", "Jupyter",
        "XGBoost", "LightGBM", "CatBoost", "ONNX", "JAX",
        "Keras", "SpaCy", "NLTK", "Transformers",
        "GPT", "BERT", "Diffusion", "RAG", "Vector DB",
        "Pinecone", "Weaviate", "Milvus", "Chroma",
        "SageMaker", "Vertex AI", "MLflow", "Weights & Biases",
        "DVC", "BentoML", "Triton", "vLLM",
        "OpenCV", "YOLO", "Stable Diffusion",
    ],
    "mobile": [
        "React Native", "Flutter", "SwiftUI", "Jetpack Compose",
        "Xamarin", "Ionic", "Cordova",
        "Expo", "Capacitor", "MAUI", "Kotlin Multiplatform",
        "UIKit", "Core Data", "ARKit", "Core ML",
        "Android SDK", "Gradle", "CocoaPods", "SPM",
    ],
    "tools": [
        "Git", "Jira", "Confluence", "Figma", "Postman",
        "Swagger", "OpenAPI", "Notion", "Slack",
        "Miro", "Linear", "Asana", "Trello", "Monday",
        "IntelliJ", "VS Code", "Vim", "Neovim",
        "Charles", "Wireshark", "Fiddler",
        "Playwright", "Cypress", "Selenium", "Puppeteer",
        "Jest", "Mocha", "pytest", "JUnit", "RSpec",
        "Storybook", "Chromatic",
    ],
    "security": [
        "OAuth", "SAML", "JWT", "OpenID Connect", "OIDC",
        "SSO", "MFA", "RBAC", "ABAC",
        "SOC 2", "HIPAA", "PCI DSS", "GDPR", "ISO 27001",
        "Burp Suite", "OWASP", "Snyk", "Dependabot",
    ],
    "messaging_queue": [
        "SQS", "SNS", "EventBridge", "PubSub",
        "ActiveMQ", "ZeroMQ", "Celery", "Sidekiq",
    ],
    # ── Marketing / Growth ──
    "marketing": [
        "Google Ads", "Google Analytics", "GA4", "Google Tag Manager", "GTM",
        "Facebook Ads", "Meta Ads", "Instagram Ads", "TikTok Ads",
        "LinkedIn Ads", "Twitter Ads", "Pinterest Ads", "Snapchat Ads",
        "SEO", "SEM", "PPC", "CPC", "CPM", "CPA", "ROAS", "CTR",
        "HubSpot", "Marketo", "Mailchimp", "SendGrid", "Klaviyo",
        "Salesforce Marketing Cloud", "ActiveCampaign", "Brevo",
        "Ahrefs", "SEMrush", "Moz", "Screaming Frog",
        "Hootsuite", "Buffer", "Sprout Social", "Later",
        "Canva", "Adobe Creative Suite", "Photoshop", "Illustrator",
        "InDesign", "Premiere Pro", "After Effects",
        "WordPress", "Webflow", "Shopify", "Wix", "Squarespace",
        "Hotjar", "Mixpanel", "Amplitude", "Segment",
        "A/B testing", "conversion optimization", "CRO",
        "Looker", "Tableau", "Power BI", "Data Studio",
        "Google Search Console", "Google Optimize",
    ],
    # ── Sales / CRM ──
    "sales": [
        "Salesforce", "HubSpot CRM", "Pipedrive", "Zoho CRM",
        "SAP", "Oracle CRM", "Dynamics 365", "Microsoft Dynamics",
        "Outreach", "SalesLoft", "Apollo", "ZoomInfo", "LinkedIn Sales Navigator",
        "Gong", "Chorus", "Clari", "Seismic",
        "CRM", "ERP", "SaaS",
        "cold calling", "prospecting", "pipeline management",
        "account management", "territory planning",
        "lead generation", "lead qualification", "lead scoring",
        "B2B", "B2C", "D2C",
    ],
    # ── Design ──
    "design": [
        "Figma", "Sketch", "Adobe XD", "InVision", "Zeplin",
        "Principle", "Framer", "ProtoPie", "Axure",
        "Photoshop", "Illustrator", "InDesign",
        "After Effects", "Premiere Pro", "Final Cut",
        "Blender", "Cinema 4D", "Maya",
        "Lottie", "Rive", "Spline",
        "Miro", "FigJam", "Whimsical",
        "design systems", "wireframing", "prototyping",
        "user research", "usability testing", "A/B testing",
        "accessibility", "WCAG",
        "responsive design", "mobile-first",
    ],
    # ── HR / People ──
    "hr": [
        "Workday", "BambooHR", "Greenhouse", "Lever", "Ashby",
        "iCIMS", "Taleo", "SmartRecruiters", "Jobvite",
        "ADP", "Gusto", "Rippling", "Deel", "Remote\\.com",
        "Lattice", "Culture Amp", "15Five",
        "SAP SuccessFactors", "Oracle HCM",
        "LinkedIn Recruiter", "Indeed", "Glassdoor",
        "HRIS", "ATS", "HRMS",
        "talent acquisition", "employer branding",
        "performance management", "onboarding",
        "compensation", "benefits administration",
        "employee engagement", "succession planning",
        "labor law", "employment law",
    ],
    # ── Finance / Accounting ──
    "finance": [
        "Excel", "Google Sheets", "VBA", "macros",
        "QuickBooks", "Xero", "FreshBooks", "Wave",
        "NetSuite", "SAP", "Oracle Financials",
        "Bloomberg Terminal", "Reuters", "FactSet",
        "Tableau", "Power BI", "Looker",
        "SQL", "Python", "R\\b",
        "GAAP", "IFRS", "SOX",
        "financial modeling", "DCF", "LBO",
        "budgeting", "forecasting", "variance analysis",
        "accounts payable", "accounts receivable",
        "general ledger", "bank reconciliation",
        "tax compliance", "audit",
        "ERP", "CPA", "CFA", "ACCA",
    ],
    # ── Operations / PM ──
    "operations": [
        "Jira", "Asana", "Monday\\.com", "ClickUp", "Trello",
        "Confluence", "Notion", "Linear",
        "MS Project", "Smartsheet", "Basecamp",
        "Lean", "Six Sigma", "Agile", "Scrum", "Kanban",
        "SAFe", "Prince2", "PMP", "ITIL",
        "OKR", "KPI",
        "Lucidchart", "Visio", "Draw\\.io",
        "supply chain", "inventory management",
        "process improvement", "change management",
        "stakeholder management", "vendor management",
        "risk management", "quality assurance",
    ],
    # ── Customer / Support ──
    "customer_support": [
        "Zendesk", "Freshdesk", "Intercom", "Drift",
        "ServiceNow", "Help Scout", "LiveChat",
        "Salesforce Service Cloud",
        "ticketing system", "knowledge base",
        "SLA", "NPS", "CSAT", "CES",
        "troubleshooting", "escalation",
        "call center", "IVR", "VoIP",
        "customer retention", "churn reduction",
    ],
    # ── Admin / Legal ──
    "admin_legal": [
        "Microsoft Office", "Microsoft 365", "Google Workspace",
        "Word", "PowerPoint", "Outlook", "Teams",
        "DocuSign", "Adobe Acrobat", "SharePoint",
        "SAP", "Oracle", "ERP",
        "contract management", "NDA",
        "corporate governance", "regulatory compliance",
        "intellectual property", "IP",
        "GDPR", "data protection", "privacy",
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


# ══════════════════════════════════════════════════════════════════════
# SECTION-AWARE KEYWORD EXTRACTION
# ══════════════════════════════════════════════════════════════════════

def _extract_via_keywords(
    sections: list[Section],
    dictionary,
    field_name: str,
    *,
    candidate_validator=None,
) -> FieldResult:
    """
    Run keyword matching across all sections, apply section weighting
    and negative rules, then resolve conflicts.
    """
    candidates: list[FieldResult] = []

    for section in sections:
        kw_match = dictionary.best_match(section.text)
        if kw_match:
            if candidate_validator and not candidate_validator(section, kw_match):
                continue
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
    *,
    candidate_validator=None,
) -> FieldResult:
    """
    Run a regex-based extractor across all sections, with section weighting
    and negative rules.
    """
    candidates: list[FieldResult] = []

    for section in sections:
        val = regex_fn(section.text)
        if val:
            if candidate_validator and not candidate_validator(section, val):
                continue
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


def _allow_seniority_keyword(section: Section, match: KeywordMatch) -> bool:
    lowered = section.text.lower()
    matched = match.matched_text.lower()

    if match.canonical != "Lead":
        return True

    if section.name not in {"responsibilities", "general"}:
        return True

    return not re.search(
        rf"\b{re.escape(matched)}\s+"
        r"(?:the|a|an|our|cross[\s\-]?functional|day[\s\-]?to[\s\-]?day|"
        r"process|processes|delivery|execution|implementation|design|roadmap)\b",
        lowered,
        re.IGNORECASE,
    )


def _allow_seniority_regex(section: Section, value: str) -> bool:
    normalized = normalize_seniority(value)
    if normalized != "Lead" or section.name not in {"responsibilities", "general"}:
        return True
    lowered = section.text.lower()
    return not re.search(
        r"\blead\s+"
        r"(?:the|a|an|our|cross[\s\-]?functional|day[\s\-]?to[\s\-]?day|"
        r"process|processes|delivery|execution|implementation|design|roadmap)\b",
        lowered,
        re.IGNORECASE,
    )


def _structured_result(
    values: list[str],
    normalizer,
    *,
    evidence: str,
) -> FieldResult:
    for value in values:
        normalized = normalizer(value)
        if normalized:
            return FieldResult(
                value=normalized,
                confidence=0.95,
                method="structured",
                evidence=evidence,
            )
    return FieldResult()


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
    """
    report = ExtractionReport()
    struct = structured_fields or {}
    canonical = build_canonical_vacancy_signals(
        title=title,
        description=description,
        location_str=location_str,
        source=source,
        apply_url=apply_url,
        card_data=card_data,
        structured_fields=structured_fields,
    )

    # ── Step 1: Parse into sections ──────────────────────────────────
    sections = parse_sections(
        title=canonical.title,
        card_labels=canonical.card_label_text or None,
        description=canonical.combined_text,
    )

    # ── Step 2: Keyword-based extraction (multilingual, section-weighted) ──
    report.work_mode = _extract_via_keywords(sections, WORK_MODE_DICT, "work_mode")
    report.job_type = _extract_via_keywords(sections, JOB_TYPE_DICT, "job_type")
    report.seniority = _extract_via_keywords(
        sections,
        SENIORITY_DICT,
        "seniority",
        candidate_validator=_allow_seniority_keyword,
    )

    # ── Step 3: Regex-based extraction (section-weighted) ──
    # Only fill if keywords didn't find anything
    work_mode_regex = _extract_via_regex(sections, extract_work_mode, "work_mode")
    if report.work_mode.is_empty:
        report.work_mode = work_mode_regex
    elif not work_mode_regex.is_empty and report.work_mode.method != "structured":
        # Hybrid from regex should override Remote/On-site from keywords
        # because hybrid patterns are more specific (e.g., "X days in office" patterns)
        if work_mode_regex.value == "Hybrid" and report.work_mode.value != "Hybrid":
            report.work_mode = work_mode_regex
        # If regex found different value with higher confidence, use it
        elif work_mode_regex.confidence > report.work_mode.confidence:
            report.work_mode = work_mode_regex

    if report.job_type.is_empty:
        report.job_type = _extract_via_regex(sections, extract_job_type, "job_type")

    if report.seniority.is_empty:
        report.seniority = _extract_via_regex(
            sections,
            extract_seniority,
            "seniority",
            candidate_validator=_allow_seniority_regex,
        )

    report.experience_years = _extract_via_regex(
        sections,
        extract_experience_years,
        "experience_years",
    )

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
    structured_work_mode = _structured_result(
        canonical.workplace_type_raw + canonical.applicant_location_requirements_raw,
        normalize_work_mode,
        evidence="Structured workplace signal",
    )
    if not structured_work_mode.is_empty:
        report.work_mode = structured_work_mode

    structured_job_type = _structured_result(
        canonical.employment_type_raw,
        normalize_job_type,
        evidence="Structured employment type",
    )
    if not structured_job_type.is_empty:
        report.job_type = structured_job_type

    structured_seniority = _structured_result(
        canonical.seniority_raw,
        normalize_seniority,
        evidence="Structured seniority signal",
    )
    if not structured_seniority.is_empty:
        report.seniority = structured_seniority

    if struct.get("experience_years"):
        report.experience_years = FieldResult(
            value=str(struct["experience_years"]),
            confidence=0.95,
            method="structured",
            evidence="Structured experience years",
        )

    if struct.get("salary"):
        report.salary = FieldResult(value=struct["salary"], confidence=0.95,
                                    method="structured", evidence="Platform API field")
    elif canonical.salary_raw:
        report.salary = FieldResult(value=canonical.salary_raw[0], confidence=0.95,
                                    method="structured", evidence="Structured salary signal")

    if struct.get("location") or canonical.primary_location:
        report.location = FieldResult(
            value=struct.get("location") or canonical.primary_location,
            confidence=0.95,
            method="structured",
            evidence="Structured location signal",
        )

    # ── Step 5: Skills extraction ───────────────────────────────────
    full_text = f"{canonical.title} {canonical.combined_text}".strip()
    if full_text:
        skills = extract_skills(full_text)
        if skills:
            report.skills = FieldResult(
                value=skills, confidence=0.80, method="keyword",
                evidence=f"Found {len(skills.split(', '))} skills",
            )

    # ── Step 6: Language requirements ───────────────────────────────
    if full_text:
        langs = extract_languages(full_text)
        if langs:
            fr = FieldResult(value=langs, confidence=0.75, method="regex", evidence=langs)
            fr = apply_negative_rules("languages", fr, full_text)
            report.languages = fr

    # ── Step 7: Location fallback ───────────────────────────────────
    if report.location.is_empty and canonical.primary_location:
        report.location = FieldResult(
            value=canonical.primary_location, confidence=0.80, method="structured",
            evidence="Provided location",
        )

    return report
