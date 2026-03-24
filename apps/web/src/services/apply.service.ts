import { APIService } from "@/services/api.service";
import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";
import { ApplyRequest, ApplyResponse, ApplyReadinessResponse, JobListing, UserProfile } from "@/types";

class ApplyService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async apply(request: ApplyRequest): Promise<ApplyResponse> {
    return this.post(ENDPOINTS.APPLY, request).then((r) => r.data);
  }

  async getReadiness(job: JobListing, profile: UserProfile | null): Promise<ApplyReadinessResponse> {
    return this.post(ENDPOINTS.APPLY_READINESS, { job, profile }).then((r) => r.data);
  }
}

export const applyService = new ApplyService();
