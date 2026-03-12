import { APIService } from "@/services/api.service";
import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";
import { SearchResponse, JobDetail, JobSource, LocationValue } from "@/types";

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
  ): Promise<SearchResponse> {
    return this.post(ENDPOINTS.SEARCH, {
      query,
      sources,
      location,
      ...filters,
    }).then((r) => r.data);
  }

  async getDetail(url: string): Promise<JobDetail> {
    return this.post(ENDPOINTS.JOB_DETAILS, { url }).then((r) => r.data);
  }
}

export const jobsService = new JobsService();
