// ---------- Enums ----------

export type WorkMode = "remote" | "hybrid" | "onsite";
export type ExperienceLevel = "intern" | "junior" | "mid" | "senior" | "lead";
export type MatchLevel = "high" | "review" | "trash";
export type ApplicationStatus = "sent" | "replied" | "rejected" | "withdrawn";
export type JobSource = "jobsearch" | "linkedin" | "indeed";

export type LocationValue = {
  type?: "region" | "country" | "city";
  value?: string;
  values?: string[];
};

// ---------- Sub-models ----------

export interface CVLink {
  name: string;
  url: string;
}

export interface UserProfile {
  name: string;
  surname: string;
  email: string;
  current_employer: string;
  work_modes: WorkMode[];
  experience_level: ExperienceLevel[];
  relocation?: boolean;
  blacklist: string[];
  cv_links: CVLink[];
  // legacy
  cvLink: string;

  // Contact fields — pre-fill job applications
  phone?: string;
  linkedin_url?: string;
  portfolio_url?: string;

  // Job search preferences — pre-fills feed filters on demand
  headline?: string;
  desired_titles?: string[];
  job_types?: string[];
  preferred_location?: LocationValue;
  salary_min?: string;
  salary_period?: "annual" | "monthly" | "hourly";
  years_of_experience?: number | null;
  availability?: string;
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
  location_str?: string;
  description_snippet?: string | null;
  // Email extracted at search time when available from job board API data
  hr_email?: string | null;
}

export interface SearchResponse {
  jobs: JobListing[];
  total: number;
  query: string;
}

// ---------- Job Detail ----------

export type ApplyMethod = "email" | "easy_apply" | "external" | "direct";

export interface JobDetail {
  title: string;
  company: string;
  description: string;
  email: string | null;
  email_found: boolean;
  apply_url: string | null;
  apply_method: ApplyMethod;
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
  cover_letter?: string | null;
  email_subject?: string | null;
  extra_cv_urls?: string[] | null;
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

// ---------- Meta ----------

export interface FilterOption {
  value: string;
  label: string;
}

export interface CityOption {
  value: string;
  label: string;
}

export interface CountryOption {
  value: string;
  label: string;
  flag?: string | null;
  currency: string;
  cities: CityOption[];
}

export interface MetaFiltersResponse {
  sources: FilterOption[];
  work_modes: FilterOption[];
  experience_levels: FilterOption[];
  job_types: FilterOption[];
  date_posted: FilterOption[];
  sort_options: FilterOption[];
  countries: CountryOption[];
}
