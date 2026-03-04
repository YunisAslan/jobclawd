import { APIService } from "@/services/api.service";
import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";
import { SearchResponse, JobDetail, UserProfile, JobSource } from "@/types";

class JobsService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async search(
    query: string,
    sources: JobSource[],
    location?: any,
    filters?: any,
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
