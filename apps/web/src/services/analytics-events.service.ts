import { APIService } from "@/services/api.service";
import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";
import type { CvAnalyzedEvent, SuggestionAppliedEvent, ImpactCheckedEvent } from "@/types";

function getAuthHeader(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const match = document.cookie.match(/(?:^|; )jc_token=([^;]*)/);
  const token = match ? decodeURIComponent(match[1]) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

class AnalyticsEventsService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  trackCvAnalyzed(payload: CvAnalyzedEvent): void {
    this.post(ENDPOINTS.ANALYTICS_CV_ANALYZED, payload, { headers: getAuthHeader() }).catch(() => {});
  }

  trackSuggestionApplied(payload: SuggestionAppliedEvent): void {
    this.post(ENDPOINTS.ANALYTICS_SUGGESTION_APPLIED, payload, { headers: getAuthHeader() }).catch(() => {});
  }

  trackImpactChecked(payload: ImpactCheckedEvent): void {
    this.post(ENDPOINTS.ANALYTICS_IMPACT_CHECKED, payload, { headers: getAuthHeader() }).catch(() => {});
  }
}

export const analyticsEventsService = new AnalyticsEventsService();
