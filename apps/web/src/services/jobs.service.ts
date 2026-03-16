import { APIService } from "@/services/api.service";
import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";
import { SearchResponse, JobDetail, JobSource, LocationValue } from "@/types";

function getAuthHeader(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const match = document.cookie.match(/(?:^|; )jc_token=([^;]*)/);
  const token = match ? decodeURIComponent(match[1]) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface SearchFilters {
  workModes?: string[];
  experience?: string[];
  jobTypes?: string[];
  datePosted?: string;
  salaryMin?: string;
  sortBy?: string;
}

class JobsService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async search(
    query: string,
    sources: JobSource[],
    location?: LocationValue,
    filters?: SearchFilters,
    forceRefresh?: boolean,
  ): Promise<SearchResponse> {
    return this.post(ENDPOINTS.SEARCH, {
      query,
      sources,
      location,
      ...filters,
      ...(forceRefresh ? { forceRefresh: true } : {}),
    }, { headers: getAuthHeader() }).then((r) => r.data);
  }

  async getDetail(url: string): Promise<JobDetail> {
    return this.post(ENDPOINTS.JOB_DETAILS, { url }).then((r) => r.data);
  }

  async getCredits(): Promise<{ credits: number; max_credits: number }> {
    return this.get(ENDPOINTS.CREDITS, {}, { headers: getAuthHeader() }).then((r) => r.data);
  }
}

export const jobsService = new JobsService();
