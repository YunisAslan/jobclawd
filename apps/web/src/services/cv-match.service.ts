import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";
import { APIService } from "@/services/api.service";
import type { CVAnalysisBundleResponse, CVDraftResponse, CVMatchAnalysis, CVSuggestionsResponse } from "@/types";

function getAuthHeader(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const match = document.cookie.match(/(?:^|; )jc_token=([^;]*)/);
  const token = match ? decodeURIComponent(match[1]) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

class CVMatchService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getAnalysis(job_url: string, cv_url: string): Promise<CVMatchAnalysis> {
    const res = await this.post(
      ENDPOINTS.CV_MATCH,
      { job_url, cv_url },
      { headers: getAuthHeader(), timeout: 60000 },
    );
    return res.data;
  }

  async getSuggestions(job_url: string, cv_url: string): Promise<CVSuggestionsResponse> {
    const res = await this.post(
      ENDPOINTS.CV_SUGGESTIONS,
      { job_url, cv_url },
      { headers: getAuthHeader(), timeout: 60000 },
    );
    return res.data;
  }

  async getDraft(cv_url: string): Promise<CVDraftResponse> {
    const res = await this.post(
      ENDPOINTS.CV_DRAFT,
      { cv_url },
      { headers: getAuthHeader(), timeout: 60000 },
    );
    return res.data;
  }

  async exportDraft(cv_url: string, content: string, file_name?: string): Promise<{ blob: Blob; filename: string }> {
    const res = await this.post(
      ENDPOINTS.CV_EXPORT,
      { cv_url, content, file_name },
      { headers: getAuthHeader(), timeout: 60000, responseType: "blob" },
    );

    const disposition = res.headers["content-disposition"] as string | undefined;
    const match = disposition?.match(/filename="([^"]+)"/);
    return {
      blob: res.data,
      filename: match?.[1] || "updated-cv.docx",
    };
  }

  async getBundle(job_url: string, cv_url: string): Promise<CVAnalysisBundleResponse> {
    const res = await this.post(
      ENDPOINTS.CV_ANALYSIS_BUNDLE,
      { job_url, cv_url },
      { headers: getAuthHeader(), timeout: 60000 },
    );
    return res.data;
  }
}

export const cvMatchService = new CVMatchService();
