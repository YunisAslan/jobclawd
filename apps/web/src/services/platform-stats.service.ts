import { APIService } from "@/services/api.service";
import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";

export interface PlatformStats {
  total_analyses: number;
  suggestions_applied: number;
  cvs_compared: number;
  searched_jobs: number;
}

class PlatformStatsService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getStats(): Promise<PlatformStats> {
    const res = await this.get(ENDPOINTS.PLATFORM_STATS);
    return res.data as PlatformStats;
  }
}

export const platformStatsService = new PlatformStatsService();
