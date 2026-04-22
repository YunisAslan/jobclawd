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
  headline?: string;
  avatar_url?: string;
  job_types?: string[];
  preferred_location?: LocationValue;
  salary_min?: string;
  salary_period?: SalaryPeriod;
  onboarding_completed?: boolean;
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
  | "address_requirements"
  | "address_gaps";

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
}

export interface CVAnalysisBundleResponse {
  analysis: CVMatchAnalysis;
  suggestions: CVSuggestionsResponse;
  draft: CVDraftResponse;
  error_analysis?: string | null;
  error_suggestions?: string | null;
  error_draft?: string | null;
}

export interface CachedAnalysisEntry {
  cv_url: string;
  cv_name: string;
  analysis: CVMatchAnalysis;
}

export interface CachedAnalysisListResponse {
  entries: CachedAnalysisEntry[];
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

// ── Analytics ──

export interface CVAnalyticsEntry {
  cv_name: string;
  analyses: number;
  avg_score: number;
  best_score: number;
}

export interface ScoreDistributionEntry {
  band: string;
  count: number;
}

export interface TopJobTitleEntry {
  title: string;
  count: number;
}

export interface SourceBreakdownEntry {
  source: string;
  count: number;
}

export interface AnalyticsResponse {
  total_analyses: number;
  total_apply_clicks: number;
  total_suggestions_applied: number;
  total_saved: number;
  avg_match_score: number;
  cvs_compared: number;
  total_impact_checks: number;
  avg_score_delta: number;
  cv_performance: CVAnalyticsEntry[];
  score_distribution: ScoreDistributionEntry[];
  top_job_titles: TopJobTitleEntry[];
  source_breakdown: SourceBreakdownEntry[];
  trend_30d: WeeklyChartEntry[];
  analysis_to_apply_ratio: number;
}

// ── Analytics event tracking payloads ──

export interface CvAnalyzedEvent {
  cv_url: string;
  cv_name: string;
  job_url: string;
  job_title: string;
  company: string;
  overall_score: number;
  match_level: string;
}

export interface SuggestionAppliedEvent {
  cv_name: string;
  job_url: string;
  category: string;
  priority: string;
}

export interface ImpactCheckedEvent {
  cv_name: string;
  job_url: string;
  score_before: number;
  score_after: number;
}

export interface ApplyClickEvent {
  job_url: string;
  job_title: string;
  company: string;
}

// ── Structured CV Data ──

export interface CVPersonalInfo {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  portfolio: string;
  summary: string;
  photo?: string; // base64 data URL, e.g. "data:image/jpeg;base64,..."
  email_link?: string;
  phone_link?: string;
  linkedin_link?: string;
  portfolio_link?: string;
}

export interface CVExperienceEntry {
  id: string;
  company: string;
  title: string;
  location: string;
  start_date: string;
  end_date: string;
  bullets: string[];
  link?: string;
}

export interface CVEducationEntry {
  id: string;
  institution: string;
  degree: string;
  field_of_study: string;
  start_date: string;
  end_date: string;
  details: string[];
  link?: string;
}

export interface CVSkillGroup {
  category: string;
  items: string[];
}

export interface CVLanguageEntry {
  language: string;
  level: string;
}

export interface CVCertificationEntry {
  id: string;
  name: string;
  issuer: string;
  date: string;
  link?: string;
}

export interface CVAdditionalEntry {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  bullets: string[];
  link?: string;
}

export interface CVData {
  personal_info: CVPersonalInfo;
  experience: CVExperienceEntry[];
  education: CVEducationEntry[];
  skills: CVSkillGroup[];
  languages: CVLanguageEntry[];
  certifications: CVCertificationEntry[];
  additional_sections: Record<string, CVAdditionalEntry[]>;
  /** Section keys in original document order. "personal_info" maps to the
   *  editor's "personal" key. Empty means default order. */
  section_order?: string[];
}
