import {
  SearchResponse,
  JobDetail,
  UserProfile,
  JobSource,
  ApplyRequest,
  ApplyResponse,
  ApplicationRecord,
  ApplicationStatus,
  StatsResponse,
  SMTPSettings,
  AutopilotSettings,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Xəta baş verdi" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ---------- Search ----------

export async function searchJobs(query: string): Promise<SearchResponse> {
  const res = await fetch(`${API_BASE}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return handleResponse<SearchResponse>(res);
}

export async function searchJobsWithProfile(
  query: string,
  profile: UserProfile,
  sources: JobSource[]
): Promise<SearchResponse> {
  const res = await fetch(`${API_BASE}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, profile, sources }),
  });
  return handleResponse<SearchResponse>(res);
}

// ---------- Job Detail ----------

export async function getJobDetails(url: string): Promise<JobDetail> {
  const res = await fetch(`${API_BASE}/api/job-details`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return handleResponse<JobDetail>(res);
}

// ---------- Apply ----------

export async function applyToJob(request: ApplyRequest): Promise<ApplyResponse> {
  const res = await fetch(`${API_BASE}/api/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return handleResponse<ApplyResponse>(res);
}

// ---------- Applications ----------

export async function getApplications(): Promise<ApplicationRecord[]> {
  const res = await fetch(`${API_BASE}/api/applications`);
  return handleResponse<ApplicationRecord[]>(res);
}

export async function updateApplicationStatus(
  id: number,
  status: ApplicationStatus,
  notes?: string
): Promise<ApplicationRecord> {
  const res = await fetch(`${API_BASE}/api/applications/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, notes }),
  });
  return handleResponse<ApplicationRecord>(res);
}

// ---------- Stats ----------

export async function getStats(): Promise<StatsResponse> {
  const res = await fetch(`${API_BASE}/api/stats`);
  return handleResponse<StatsResponse>(res);
}

// ---------- Settings ----------

export async function getSMTPSettings(): Promise<SMTPSettings> {
  const res = await fetch(`${API_BASE}/api/settings/smtp`);
  return handleResponse<SMTPSettings>(res);
}

export async function saveSMTPSettings(settings: SMTPSettings): Promise<void> {
  const res = await fetch(`${API_BASE}/api/settings/smtp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  await handleResponse<unknown>(res);
}

export async function getAutopilotSettings(): Promise<AutopilotSettings> {
  const res = await fetch(`${API_BASE}/api/settings/autopilot`);
  return handleResponse<AutopilotSettings>(res);
}

export async function saveAutopilotSettings(
  settings: AutopilotSettings
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/settings/autopilot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  await handleResponse<unknown>(res);
}
