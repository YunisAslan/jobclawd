// ──────────────────────────────────────────────
// Shared types — used by both frontend and backend
// ──────────────────────────────────────────────

import type {
  WorkMode,
  ExperienceLevel,
  MatchLevel,
  ApplicationStatus,
  JobSource,
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

export interface LocationValue {
  type?: LocationType;
  value?: string;
  values?: string[];
}

export interface UserProfile {
  name: string;
  surname: string;
  email: string;
  work_modes: WorkMode[];
  experience_level: ExperienceLevel[];
  relocation?: boolean;
  blacklist: string[];
  cv_links: CVLink[];
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
  education?: EducationEntry[];
  skills?: string[];
  language_levels?: LanguageEntry[];
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
  seniority_str?: string | null;
  seniority_src?: string | null;
  experience_years_str?: string | null;
  experience_years_src?: string | null;
  experience_str?: string | null;
  experience_src?: string | null;
  job_type_str?: string | null;
  job_type_src?: string | null;
  salary_str?: string | null;
  salary_src?: string | null;
  description_snippet?: string | null;
  hr_email?: string | null;
  // Vacancy Intelligence Engine fields
  skills_str?: string | null;
  languages_str?: string | null;
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

export interface JobDetail {
  title: string;
  company: string;
  description: string;
  email: string | null;
  email_found: boolean;
  apply_url: string | null;
  error_message: string | null;
  resolved_apply_url: string | null;
  apply_url_confidence: number;
  apply_requires_login: boolean;
  fallback_urls: string[];
  // Structured vacancy understanding (enhanced detail)
  requirements?: string[];
  nice_to_haves?: string[];
  required_skills?: string[];
  required_experience?: string | null;
  job_summary?: string | null;
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
  status: string;
}

export interface MissingFieldInfo {
  field: string;
  label: string;
}

export interface ApplyReadinessResponse {
  score: number;
  readiness_level: "ready" | "partial" | "basic";
  readiness_label: string;
  missing_required: MissingFieldInfo[];
  missing_optional: MissingFieldInfo[];
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

// ── Saved Vacancies ──

export interface SavedVacancy {
  id: number;
  job_url: string;
  job_data: JobListing;
  saved_at: string;
  expires_at: string;
}

export interface SavedVacanciesResponse {
  vacancies: SavedVacancy[];
  total: number;
}

export interface SaveCheckResponse {
  saved_urls: string[];
}

// ── CV Match Analysis ──

export interface CVMatchCategory {
  category: string;
  score: number;
  matched: string[];
  missing: string[];
  reasoning: string;
}

export interface CVMatchAnalysis {
  overall_score: number;
  match_level: MatchLevel;
  categories: CVMatchCategory[];
  summary: string;
}

// ── CV Optimization Suggestions ──

export type SuggestionPriority = "high" | "medium" | "low";
export type SuggestionCategory =
  | "add_keywords"
  | "rewrite_bullets"
  | "elevate_experience"
  | "reduce_irrelevant"
  | "improve_headline"
  | "address_requirements";

export interface CVSuggestion {
  category: SuggestionCategory;
  priority: SuggestionPriority;
  title: string;
  description: string;
  specific_text?: string | null;
  suggested_text?: string | null;
}

export interface CVSuggestionsResponse {
  suggestions: CVSuggestion[];
  total: number;
  job_title: string;
  job_company: string;
}

export interface CVDraftResponse {
  text: string;
  file_name: string;
  html?: string | null;
}

export interface CVAnalysisBundleResponse {
  analysis: CVMatchAnalysis;
  suggestions: CVSuggestionsResponse;
  draft: CVDraftResponse;
  error_analysis?: string | null;
  error_suggestions?: string | null;
  error_draft?: string | null;
}

// ── Vacancy Panel ──

export interface VacancyPanelProps {
  job: JobListing | null;
  onClose: () => void;
  onSaved?: () => void;
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

// ── Document Session ──

export type DocumentSourceType = "pdf" | "docx";
export type DocumentConversionStatus = "none" | "pending" | "done" | "failed";

export interface OnlyOfficeConfig {
  documentType: string;
  document: {
    fileType: string;
    key: string;
    title: string;
    url: string;
    permissions?: Record<string, boolean>;
  };
  editorConfig: {
    callbackUrl: string;
    mode: string;
    lang?: string;
    user?: { id: string; name: string };
    customization?: Record<string, unknown>;
  };
  token?: string;
  /** Browser-accessible ONLYOFFICE server URL (not in the signed JWT payload) */
  _server_url?: string;
  type?: string;
  height?: string;
  width?: string;
}

export interface DocumentSession {
  session_id: string;
  source_type: DocumentSourceType;
  preview_url: string;
  editable_url: string | null;
  requires_conversion: boolean;
  conversion_status: DocumentConversionStatus;
  cv_name: string;
  onlyoffice_config: OnlyOfficeConfig | null;
}
