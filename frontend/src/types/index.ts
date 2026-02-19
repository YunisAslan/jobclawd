// ---------- Enums ----------

export type WorkMode = "remote" | "hybrid" | "onsite";
export type ExperienceLevel = "junior" | "mid" | "senior" | "lead";
export type MatchLevel = "high" | "review" | "trash";
export type ApplicationStatus = "sent" | "replied" | "rejected" | "withdrawn";
export type JobSource = "jobsearch" | "linkedin" | "indeed";

// ---------- Sub-models ----------

export interface CVLink {
  name: string;
  url: string;
}

export interface UserProfile {
  name: string;
  surname: string;
  phone: string;
  email: string;
  current_employer: string;
  work_modes: WorkMode[];
  experience_level: ExperienceLevel;
  relocation: boolean;
  blacklist: string[];
  cv_links: CVLink[];
  // legacy
  cvLink: string;
}

// ---------- Search ----------

export interface JobListing {
  title: string;
  company: string;
  url: string;
  date_posted: string;
  view_count?: number;
  source: JobSource;
  logo_url?: string | null;
  match_score: number;
  match_level: MatchLevel;
  match_flags: string[];
}

export interface SearchResponse {
  jobs: JobListing[];
  total: number;
  query: string;
}

// ---------- Job Detail ----------

export interface JobDetail {
  title: string;
  company: string;
  description: string;
  email: string | null;
  email_found: boolean;
  apply_url: string | null;
  error_message: string | null;
}

// ---------- Apply ----------

export interface ApplyRequest {
  job_url: string;
  job_title: string;
  company: string;
  source: JobSource;
  hr_email?: string | null;
  cv_name?: string | null;
  cv_url?: string | null;
  match_score?: number | null;
  match_level?: MatchLevel | null;
  profile?: UserProfile | null;
}

export interface ApplyResponse {
  success: boolean;
  application_id?: number | null;
  message: string;
  sent_via_smtp: boolean;
}

// ---------- Applications ----------

export interface ApplicationRecord {
  id: number;
  job_url: string;
  job_title: string;
  company: string;
  source: string;
  hr_email?: string | null;
  cv_name?: string | null;
  cv_url?: string | null;
  match_score?: number | null;
  match_level?: string | null;
  status: ApplicationStatus;
  sent_at: string;
  notes?: string | null;
}

// ---------- Stats ----------

export interface WeeklyChartEntry {
  date: string;
  count: number;
}

export interface CVPerformanceEntry {
  cv_name: string;
  sent: number;
  replies: number;
}

export interface StatsResponse {
  today_count: number;
  total_sent: number;
  total_replies: number;
  weekly_chart: WeeklyChartEntry[];
  cv_performance: CVPerformanceEntry[];
}

// ---------- Settings ----------

export interface SMTPSettings {
  host: string;
  port: number;
  username: string;
  password?: string | null;
  from_name: string;
}

export interface AutopilotSettings {
  enabled: boolean;
}
