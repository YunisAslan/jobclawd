import { APIService } from "@/services/api.service";
import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";
import { StatsResponse } from "@/components/dashboard/types";

class StatsService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getStats(): Promise<StatsResponse> {
    return this.get(ENDPOINTS.STATS, {}).then((r) => r.data);
  }
}

export const statsService = new StatsService();
