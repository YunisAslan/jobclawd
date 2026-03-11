export type WorkMode = "remote" | "hybrid" | "onsite";
export type ExperienceLevel = "intern" | "junior" | "mid" | "senior" | "lead";

export type LocationValue = {
  type?: "region" | "country" | "city";
  value?: string;
  values?: string[];
};

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
  cvLink: string;
  phone?: string;
  linkedin_url?: string;
  portfolio_url?: string;
  headline?: string;
  desired_titles?: string[];
  job_types?: string[];
  preferred_location?: LocationValue;
  salary_min?: string;
  salary_period?: "annual" | "monthly" | "hourly";
  years_of_experience?: number | null;
  availability?: string;
}
