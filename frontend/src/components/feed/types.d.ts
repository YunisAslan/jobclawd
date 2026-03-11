import { CVLink, UserProfile } from "@/components/profile/types";

// Search

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

export type JobSource = "jobsearch" | "linkedin" | "indeed";
export type MatchLevel = "high" | "review" | "trash";

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
  hr_email?: string | null;
}

export interface SearchResponse {
  jobs: JobListing[];
  total: number;
  query: string;
}

// Detail & apply method

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

// Apply request / response

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

// Apply drawer

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
