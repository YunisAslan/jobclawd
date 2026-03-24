// ──────────────────────────────────────────────
// Shared types — used by both frontend and backend
// ──────────────────────────────────────────────

import type {
  WorkMode,
  ExperienceLevel,
  MatchLevel,
  ApplicationStatus,
  JobSource,
  ApplyMethod,
  SalaryPeriod,
  LocationType,
} from "./constants";

// ── Profile ──

export interface CVLink {
  name: string;
  url: string;
}

export interface EducationEntry {
  institution: string;
  degree: string;
  field_of_study: string;
  start_year?: number | null;
  end_year?: number | null;
}

export interface LanguageEntry {
  language: string;
  level: string;
}

export interface CoverLetterTemplate {
  name: string;
  body: string;
}

export interface LocationValue {
  type?: LocationType;
  value?: string;
  values?: string[];
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
  cvLink: string;
  phone?: string;
  linkedin_url?: string;
  portfolio_url?: string;
  github_url?: string;
  headline?: string;
  avatar_url?: string;
  desired_titles?: string[];
  job_types?: string[];
  preferred_location?: LocationValue;
  salary_min?: string;
  salary_period?: SalaryPeriod;
  years_of_experience?: number | null;
  availability?: string;
  work_authorization?: string;
  notice_period?: string;
  education?: EducationEntry[];
  skills?: string[];
  language_levels?: LanguageEntry[];
  cover_letter_templates?: CoverLetterTemplate[];
}

// ── Feed / Search ──

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
  work_mode_str?: string | null;
  work_mode_src?: string | null;
  experience_str?: string | null;
  experience_src?: string | null;
  job_type_str?: string | null;
  job_type_src?: string | null;
  salary_str?: string | null;
  salary_src?: string | null;
  description_snippet?: string | null;
  hr_email?: string | null;
  apply_method?: ApplyMethod | null;
  apply_method_src?: string | null;
  apply_method_conf?: number | null;
  // Vacancy Intelligence Engine fields
  skills_str?: string | null;
  languages_str?: string | null;
  work_auth_str?: string | null;
  apply_complexity?: "easy" | "moderate" | "hard" | null;
  auto_apply_support?: "full" | "assisted" | "manual" | null;
  parse_confidence?: number | null;
  badges?: string[];
}

export interface SearchResponse {
  jobs: JobListing[];
  total: number;
  query: string;
  cached?: boolean;
}

// ── Job Detail ──

export interface EasyApplyAnalysis {
  tier: string;
  tier_label: string;
  step_count: number;
  has_resume_upload: boolean;
  has_custom_questions: boolean;
  has_cover_letter: boolean;
  unknown_fields: string[];
  safe_to_auto_submit: boolean;
}

export interface ATSInfo {
  platform: string | null;
  platform_label: string;
  confidence: number;
  prefillable_fields: string[];
  missing_fields: string[];
  apply_url: string | null;
}

export interface JobDetail {
  title: string;
  company: string;
  description: string;
  email: string | null;
  email_found: boolean;
  apply_url: string | null;
  apply_method: ApplyMethod;
  error_message: string | null;
  easy_apply: EasyApplyAnalysis | null;
  ats_info: ATSInfo | null;
}

// ── Apply ──

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
  failure_reason?: string | null;
  status: string;
}

export interface MissingFieldInfo {
  field: string;
  label: string;
}

export interface ApplyReadinessResponse {
  score: number;
  support_level: "auto" | "assisted" | "manual" | "unsupported";
  support_label: string;
  missing_required: MissingFieldInfo[];
  missing_optional: MissingFieldInfo[];
  can_auto_apply: boolean;
  method: string;
  method_label: string;
}

export interface ApplyDrawerProps {
  job: JobListing | null;
  onClose: () => void;
  onApplied: () => void;
}

export interface ApplyFormValues {
  fullName: string;
  email: string;
  phone: string;
  linkedin_url: string;
  portfolio_url: string;
  selectedCV: CVLink | null;
}

export interface ReadinessField {
  label: string;
  filled: boolean;
}

// ── Applications ──

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

// ── Stats / Dashboard ──

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

// ── Screening Answers ──

export interface ScreeningAnswer {
  id?: number | null;
  question: string;
  answer: string;
}

// ── Settings ──

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
