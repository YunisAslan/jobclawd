from enum import Enum
from typing import Optional
from pydantic import BaseModel


# ---------- Enums ----------

class WorkMode(str, Enum):
    remote = "remote"
    hybrid = "hybrid"
    onsite = "onsite"


class ExperienceLevel(str, Enum):
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


class UserProfile(BaseModel):
    name: str
    surname: str = ""
    email: str
    current_employer: str = ""
    work_modes: list[WorkMode] = [WorkMode.hybrid]
    experience_level: ExperienceLevel = ExperienceLevel.mid
    relocation: bool = False
    blacklist: list[str] = []
    cv_links: list[CVLink] = []
    # legacy field kept for backward compat
    cvLink: str = ""


# ---------- Search ----------

class LocationFilter(BaseModel):
    type: Optional[str] = None
    value: Optional[str] = None
    values: list[str] = []

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
    experience_str: Optional[str] = None
    description_snippet: Optional[str] = None


class SearchResponse(BaseModel):
    jobs: list[JobListing]
    total: int
    query: str
    currency: str = "USD"


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


class MetaFiltersResponse(BaseModel):
    sources: list[FilterOption]
    work_modes: list[FilterOption]
    experience_levels: list[FilterOption]
    job_types: list[FilterOption]
    date_posted: list[FilterOption]
    sort_options: list[FilterOption]
    countries: list[CountryOption]
