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


class EducationEntry(BaseModel):
    institution: str = ""
    degree: str = ""
    field_of_study: str = ""
    start_year: Optional[int] = None
    end_year: Optional[int] = None


class LanguageEntry(BaseModel):
    language: str = ""
    level: str = ""  # "native" | "fluent" | "advanced" | "intermediate" | "basic"


class CoverLetterTemplate(BaseModel):
    name: str = ""
    body: str = ""


class UserProfile(BaseModel):
    name: str
    surname: str = ""
    email: str
    current_employer: str = ""
    work_modes: list[WorkMode] = [WorkMode.hybrid]
    experience_level: list[ExperienceLevel] = []
    relocation: bool = False
    blacklist: list[str] = []
    cv_links: list[CVLink] = []
    # legacy field kept for backward compat
    cvLink: str = ""

    # Contact fields — used to pre-fill job applications
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    github_url: Optional[str] = None

    # Job search preference fields — used to pre-fill feed filters + apply cover letter
    headline: Optional[str] = None
    avatar_url: Optional[str] = None
    desired_titles: list[str] = []
    job_types: list[str] = []
    preferred_location: Optional[LocationFilter] = None
    salary_min: Optional[str] = None
    salary_period: Optional[str] = None          # "annual" | "monthly" | "hourly"
    years_of_experience: Optional[int] = None
    availability: Optional[str] = None

    # Extended profile fields — Phase 2
    work_authorization: Optional[str] = None     # "citizen" | "permanent_resident" | "visa_required" | "no_sponsorship"
    notice_period: Optional[str] = None          # "immediately" | "2-weeks" | "1-month" | "3-months"
    education: list[EducationEntry] = []
    skills: list[str] = []
    language_levels: list[LanguageEntry] = []
    cover_letter_templates: list[CoverLetterTemplate] = []


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
    experience_str: Optional[str] = None
    experience_src: Optional[str] = None
    job_type_str: Optional[str] = None
    job_type_src: Optional[str] = None
    salary_str: Optional[str] = None
    salary_src: Optional[str] = None
    description_snippet: Optional[str] = None
    # Email extracted at search time (when available from API data)
    hr_email: Optional[str] = None
    # How the user can apply — set at scrape time based on source & email availability
    apply_method: Optional[str] = None


class SearchResponse(BaseModel):
    jobs: list[JobListing]
    total: int
    query: str
    currency: str = "USD"
    cached: bool = False


# ---------- Job Detail ----------

class JobDetailRequest(BaseModel):
    url: str


class ApplyMethod(str, Enum):
    email = "email"
    easy_apply = "easy_apply"
    external = "external"
    direct = "direct"


class EasyApplyAnalysis(BaseModel):
    """LinkedIn Easy Apply flow complexity analysis."""
    tier: str = "unknown"                       # "A" | "B" | "C" | "unknown"
    tier_label: str = ""                        # human-readable label
    step_count: int = 0                         # number of form steps detected
    has_resume_upload: bool = False
    has_custom_questions: bool = False
    has_cover_letter: bool = False
    unknown_fields: list[str] = []              # fields not auto-fillable from profile
    safe_to_auto_submit: bool = False


class ATSInfo(BaseModel):
    """External ATS platform detection."""
    platform: Optional[str] = None              # "greenhouse" | "lever" | "workable" | "smartrecruiters" | "breezy" | "ashby" | None
    platform_label: str = ""                    # human-readable label
    confidence: float = 0.0                     # 0.0–1.0
    prefillable_fields: list[str] = []          # fields we can auto-fill from profile
    missing_fields: list[str] = []              # fields user must fill manually
    apply_url: Optional[str] = None             # direct application form URL if detected


class JobDetailResponse(BaseModel):
    title: str
    company: str
    description: str
    email: Optional[str] = None
    email_found: bool
    apply_url: Optional[str] = None
    apply_method: ApplyMethod = ApplyMethod.direct
    error_message: Optional[str] = None
    # Phase 4: Easy Apply tier classification
    easy_apply: Optional[EasyApplyAnalysis] = None
    # Phase 5: ATS platform detection
    ats_info: Optional[ATSInfo] = None


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
    sent_via_smtp: bool = False


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


# ---------- Settings ----------

class SMTPSettings(BaseModel):
    host: str
    port: int = 587
    username: str
    password: Optional[str] = None
    from_name: str = "JobClawd"


class AutopilotSettings(BaseModel):
    enabled: bool


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


# ---------- Screening Answers ----------

class ScreeningAnswer(BaseModel):
    id: Optional[int] = None
    question: str
    answer: str = ""


class ScreeningAnswersResponse(BaseModel):
    answers: list[ScreeningAnswer]


class ScreeningAnswerUpsert(BaseModel):
    question: str
    answer: str


# ---------- Meta ----------

class MetaFiltersResponse(BaseModel):
    sources: list[FilterOption]
    work_modes: list[FilterOption]
    experience_levels: list[FilterOption]
    job_types: list[FilterOption]
    date_posted: list[FilterOption]
    sort_options: list[FilterOption]
    countries: list[CountryOption]
