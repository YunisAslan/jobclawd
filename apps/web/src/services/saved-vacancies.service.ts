import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";
import { APIService } from "@/services/api.service";
import type { JobListing, SavedVacanciesResponse, SaveCheckResponse } from "@/types";

function getAuthHeader(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const match = document.cookie.match(/(?:^|; )jc_token=([^;]*)/);
  const token = match ? decodeURIComponent(match[1]) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

class SavedVacanciesService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async list(): Promise<SavedVacanciesResponse> {
    const res = await this.get(ENDPOINTS.SAVED_VACANCIES, {}, {
      headers: getAuthHeader(),
    });
    return res.data;
  }

  async save(job_url: string, job_data: JobListing): Promise<{ success: boolean; id: number }> {
    const res = await this.post(
      ENDPOINTS.SAVED_VACANCIES,
      { job_url, job_data },
      { headers: getAuthHeader() },
    );
    return res.data;
  }

  async unsave(job_url: string): Promise<void> {
    await this.delete(ENDPOINTS.SAVED_VACANCIES, {
      headers: getAuthHeader(),
      data: { job_url },
    });
  }

  async batchCheck(job_urls: string[]): Promise<SaveCheckResponse> {
    const res = await this.post(
      ENDPOINTS.SAVED_VACANCIES_CHECK,
      { job_urls },
      { headers: getAuthHeader() },
    );
    return res.data;
  }
}

export const savedVacanciesService = new SavedVacanciesService();
