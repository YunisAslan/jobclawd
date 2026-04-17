import { APIService } from "@/services/api.service";
import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";
import { StatsResponse, AnalyticsResponse } from "@/types";

class StatsService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getStats(): Promise<StatsResponse> {
    return this.get(ENDPOINTS.STATS, {}).then((r) => r.data);
  }

  async getAnalytics(): Promise<AnalyticsResponse> {
    return this.get(ENDPOINTS.ANALYTICS, {}).then((r) => r.data);
  }
}

export const statsService = new StatsService();
