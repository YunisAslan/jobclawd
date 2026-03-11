export type ApplicationStatus = "sent" | "replied" | "rejected" | "withdrawn";

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
