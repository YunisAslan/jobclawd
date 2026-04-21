import { APIService } from "@/services/api.service";
import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";
import { StatsResponse, AnalyticsResponse } from "@/types";

function getAuthHeader(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const match = document.cookie.match(/(?:^|; )jc_token=([^;]*)/);
  const token = match ? decodeURIComponent(match[1]) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

class StatsService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getStats(): Promise<StatsResponse> {
    return this.get(ENDPOINTS.STATS, {}).then((r) => r.data);
  }

  async getAnalytics(): Promise<AnalyticsResponse> {
    return this.get(ENDPOINTS.ANALYTICS, {}, { headers: getAuthHeader() }).then((r) => r.data);
  }
}

export const statsService = new StatsService();
