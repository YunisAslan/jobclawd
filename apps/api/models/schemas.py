from enum import Enum
from typing import Optional
from pydantic import BaseModel


# ---------- Enums ----------

class WorkMode(str, Enum):
    remote = "remote"
    hybrid = "hybrid"
    onsite = "onsite"


class ExperienceLevel(str, Enum):
    intern = "intern"
    junior = "junior"
    mid = "mid"
    senior = "senior"
    lead = "lead"


class MatchLevel(str, Enum):
    high = "high"
    review = "review"
    trash = "trash"


class ApplicationStatus(str, Enum):
    sent = "sent"
    replied = "replied"
    rejected = "rejected"
    withdrawn = "withdrawn"
    drafted = "drafted"
    waiting_input = "waiting_input"
    open_manually = "open_manually"
    failed = "failed"


class SuggestionPriority(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"


class SuggestionCategory(str, Enum):
    add_keywords = "add_keywords"
    rewrite_bullets = "rewrite_bullets"
    elevate_experience = "elevate_experience"
    reduce_irrelevant = "reduce_irrelevant"
    improve_headline = "improve_headline"
    address_requirements = "address_requirements"
    address_gaps = "address_gaps"


class JobSource(str, Enum):
    jobsearch = "jobsearch"
    linkedin = "linkedin"
    indeed = "indeed"


# ---------- Sub-models ----------

class CVLink(BaseModel):
    name: str
    url: str


# Defined before UserProfile so it can be referenced as a field type
class LocationFilter(BaseModel):
    type: Optional[str] = None
    value: Optional[str] = None
    values: list[str] = []


class UserProfile(BaseModel):
    name: str
    surname: str = ""
    email: str
    work_modes: list[WorkMode] = [WorkMode.hybrid]
    experience_level: list[ExperienceLevel] = []
    relocation: bool = False
    blacklist: list[str] = []
    cv_links: list[CVLink] = []

    # Job search preference fields — used to pre-fill feed filters + apply cover letter
    headline: Optional[str] = None
    avatar_url: Optional[str] = None
    job_types: list[str] = []
    preferred_location: Optional[LocationFilter] = None
    salary_min: Optional[str] = None
    salary_period: Optional[str] = None          # "annual" | "monthly" | "hourly"


# ---------- Search ----------

class SearchRequest(BaseModel):
    query: str
    sources: list[JobSource] = [JobSource.jobsearch, JobSource.linkedin, JobSource.indeed]
    location: Optional[LocationFilter] = None
    workModes: Optional[list[str]] = None
    experience: Optional[list[str]] = None
    jobTypes: Optional[list[str]] = None
    datePosted: Optional[str] = None
    salaryMin: Optional[str] = None
    sortBy: Optional[str] = None
    forceRefresh: bool = False
    demo: bool = False


class JobListing(BaseModel):
    title: str
    company: str
    url: str
    date_posted: str
    view_count: Optional[int] = None
    source: JobSource = JobSource.jobsearch
    logo_url: Optional[str] = None
    match_score: int = 0
    match_level: MatchLevel = MatchLevel.review
    match_flags: list[str] = []
    location_str: Optional[str] = None
    work_mode_str: Optional[str] = None
    work_mode_src: Optional[str] = None
    seniority_str: Optional[str] = None
    seniority_src: Optional[str] = None
    experience_years_str: Optional[str] = None
    experience_years_src: Optional[str] = None
    experience_str: Optional[str] = None
    experience_src: Optional[str] = None
    job_type_str: Optional[str] = None
    job_type_src: Optional[str] = None
    salary_str: Optional[str] = None
    salary_src: Optional[str] = None
    description_snippet: Optional[str] = None
    # Email extracted at search time (when available from API data)
    hr_email: Optional[str] = None
    # Vacancy Intelligence Engine fields
    skills_str: Optional[str] = None
    languages_str: Optional[str] = None
    parse_confidence: Optional[int] = None          # 0-100
    # Summary badges for frontend display
    badges: list[str] = []


class SearchResponse(BaseModel):
    jobs: list[JobListing]
    total: int
    query: str
    currency: str = "USD"
    cached: bool = False


# ---------- Job Detail ----------

class JobDetailRequest(BaseModel):
    url: str


class JobDetailResponse(BaseModel):
    title: str
    company: str
    description: str
    email: Optional[str] = None
    email_found: bool
    apply_url: Optional[str] = None
    error_message: Optional[str] = None
    # Resolved apply link
    resolved_apply_url: Optional[str] = None
    apply_url_confidence: float = 0.0
    apply_requires_login: bool = False
    fallback_urls: list[str] = []
    # Structured vacancy understanding (enhanced detail)
    requirements: list[str] = []
    nice_to_haves: list[str] = []
    required_skills: list[str] = []
    required_experience: Optional[str] = None
    job_summary: Optional[str] = None


# ---------- Apply ----------

class ApplyRequest(BaseModel):
    job_url: str
    job_title: str
    company: str
    source: JobSource = JobSource.jobsearch
    hr_email: Optional[str] = None
    cv_name: Optional[str] = None
    cv_url: Optional[str] = None
    match_score: Optional[int] = None
    match_level: Optional[MatchLevel] = None
    cover_letter: Optional[str] = None
    email_subject: Optional[str] = None
    extra_cv_urls: Optional[list] = None
    profile: Optional[UserProfile] = None


class ApplyResponse(BaseModel):
    success: bool
    application_id: Optional[int] = None
    message: str
    status: str = "sent"                        # "sent" | "drafted" | "waiting_input" | "open_manually" | "failed"


class MissingFieldInfo(BaseModel):
    field: str
    label: str


class ApplyReadinessRequest(BaseModel):
    job: JobListing
    profile: Optional[UserProfile] = None


class ApplyReadinessResponse(BaseModel):
    score: int                                  # 0-100
    readiness_level: str                        # "ready" | "partial" | "basic"
    readiness_label: str
    missing_required: list[MissingFieldInfo]
    missing_optional: list[MissingFieldInfo]


# ---------- Applications ----------

class ApplicationRecord(BaseModel):
    id: int
    job_url: str
    job_title: str
    company: str
    source: str
    hr_email: Optional[str] = None
    cv_name: Optional[str] = None
    cv_url: Optional[str] = None
    match_score: Optional[int] = None
    match_level: Optional[str] = None
    status: str
    sent_at: str
    notes: Optional[str] = None


class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus
    notes: Optional[str] = None


# ---------- Stats ----------

class WeeklyChartEntry(BaseModel):
    date: str
    count: int


class CVPerformanceEntry(BaseModel):
    cv_name: str
    sent: int
    replies: int


class StatsResponse(BaseModel):
    today_count: int
    total_sent: int
    total_replies: int
    weekly_chart: list[WeeklyChartEntry]
    cv_performance: list[CVPerformanceEntry]


class PlatformStatsResponse(BaseModel):
    total_analyses: int
    suggestions_applied: int
    cvs_compared: int
    searched_jobs: int


# ---------- Analytics event request models ----------

class CvAnalyzedEventRequest(BaseModel):
    cv_url: str
    cv_name: str = ""
    job_url: str
    job_title: str = ""
    company: str = ""
    overall_score: int
    match_level: str = ""


class SuggestionAppliedEventRequest(BaseModel):
    cv_name: str = ""
    job_url: str = ""
    category: str
    priority: str = "medium"


class ImpactCheckedEventRequest(BaseModel):
    cv_name: str = ""
    job_url: str = ""
    score_before: int
    score_after: int


class ApplyClickEventRequest(BaseModel):
    job_url: str = ""
    job_title: str = ""
    company: str = ""


# ---------- Analytics response models ----------

class CVAnalyticsEntry(BaseModel):
    cv_name: str
    analyses: int
    avg_score: float
    best_score: int


class ScoreDistributionEntry(BaseModel):
    band: str
    count: int


class TopJobTitleEntry(BaseModel):
    title: str
    count: int


class SourceBreakdownEntry(BaseModel):
    source: str
    count: int


class AnalyticsResponse(BaseModel):
    # KPIs
    total_analyses: int
    total_searched_jobs: int
    total_suggestions_applied: int
    total_saved: int
    avg_match_score: float
    cvs_compared: int
    # Check Impact
    total_impact_checks: int
    avg_score_delta: float
    # CV performance (avg score by CV)
    cv_performance: list[CVAnalyticsEntry]
    # Score distribution
    score_distribution: list[ScoreDistributionEntry]
    # Top job titles analyzed
    top_job_titles: list[TopJobTitleEntry]
    # Source breakdown
    source_breakdown: list[SourceBreakdownEntry]
    # 30-day daily trend (analyses per day)
    trend_30d: list[WeeklyChartEntry]
    # Selectivity ratio
    analysis_to_apply_ratio: float


# ---------- Meta ----------

class FilterOption(BaseModel):
    value: str
    label: str


class CityOption(BaseModel):
    value: str
    label: str


class CountryOption(BaseModel):
    value: str
    label: str
    flag: Optional[str] = None
    currency: str
    cities: list[CityOption] = []


# ---------- Meta ----------

class MetaFiltersResponse(BaseModel):
    sources: list[FilterOption]
    work_modes: list[FilterOption]
    experience_levels: list[FilterOption]
    job_types: list[FilterOption]
    date_posted: list[FilterOption]
    sort_options: list[FilterOption]
    countries: list[CountryOption]


# ---------- Saved Vacancies ----------

class SaveVacancyRequest(BaseModel):
    job_url: str
    job_data: dict

class UnsaveVacancyRequest(BaseModel):
    job_url: str

class SavedVacancyRecord(BaseModel):
    id: int
    job_url: str
    job_data: dict
    saved_at: str
    expires_at: str

class SavedVacanciesResponse(BaseModel):
    vacancies: list[SavedVacancyRecord]
    total: int

class BatchCheckSavedRequest(BaseModel):
    job_urls: list[str]

class BatchCheckSavedResponse(BaseModel):
    saved_urls: list[str]


# ---------- CV Match Analysis ----------

class CVMatchRequest(BaseModel):
    job_url: str
    cv_url: str
    cv_name: str = ""
    demo: bool = False

class CVMatchTextRequest(BaseModel):
    job_url: str
    cv_text: str

class MatchCategoryScore(BaseModel):
    category: str               # "skills", "experience", "education", "keywords"
    score: int                  # 0-100
    matched: list[str] = []
    missing: list[str] = []
    reasoning: str = ""

class CVMatchResponse(BaseModel):
    overall_score: int          # 0-100
    match_level: MatchLevel
    categories: list[MatchCategoryScore]
    summary: str = ""


# ---------- CV Optimization Suggestions ----------

class CVSuggestionRequest(BaseModel):
    job_url: str
    cv_url: str

class CVDraftRequest(BaseModel):
    cv_url: str

class CVDraftResponse(BaseModel):
    text: str
    file_name: str = ""

class CVExportRequest(BaseModel):
    cv_url: str
    content: str
    file_name: Optional[str] = None

class CVSuggestion(BaseModel):
    category: SuggestionCategory
    priority: SuggestionPriority
    title: str
    description: str
    specific_text: Optional[str] = None
    suggested_text: Optional[str] = None

class CVSuggestionsResponse(BaseModel):
    suggestions: list[CVSuggestion]
    total: int
    job_title: str = ""
    job_company: str = ""

class CVAnalysisBundleResponse(BaseModel):
    analysis: CVMatchResponse
    suggestions: CVSuggestionsResponse
    draft: CVDraftResponse
    error_analysis: Optional[str] = None
    error_suggestions: Optional[str] = None
    error_draft: Optional[str] = None


class CachedAnalysisEntry(BaseModel):
    cv_url: str
    cv_name: str
    analysis: CVMatchResponse


class CachedAnalysisListResponse(BaseModel):
    entries: list[CachedAnalysisEntry]
