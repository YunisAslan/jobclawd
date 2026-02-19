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
    phone: str
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

class SearchRequest(BaseModel):
    query: str
    profile: Optional[UserProfile] = None
    sources: list[JobSource] = [JobSource.jobsearch]


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


class SearchResponse(BaseModel):
    jobs: list[JobListing]
    total: int
    query: str


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
