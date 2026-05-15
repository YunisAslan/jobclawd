import { APIService } from "@/services/api.service";
import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";
import { SearchResponse, JobDetail, JobSource, LocationValue } from "@/types";
import { DEMO_SEARCH_RESPONSE, DEMO_JOB_DETAIL, DEMO_JOB_URL } from "@/lib/tour-demo-data";

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

export interface SearchProgress {
  stage: string;
  message: string;
  current: number;
  total: number;
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
    demo?: boolean,
  ): Promise<SearchResponse> {
    return this.post(ENDPOINTS.SEARCH, {
      query,
      sources,
      location,
      ...filters,
      ...(forceRefresh ? { forceRefresh: true } : {}),
      ...(demo ? { demo: true } : {}),
    }, { headers: getAuthHeader() }).then((r) => r.data);
  }

  async searchStream(
    query: string,
    sources: JobSource[],
    location?: LocationValue,
    filters?: SearchFilters,
    forceRefresh?: boolean,
    onProgress?: (progress: SearchProgress) => void,
    onPartial?: (result: SearchResponse, source?: string) => void,
    demo?: boolean,
  ): Promise<SearchResponse> {
    if (demo) return DEMO_SEARCH_RESPONSE;

    const body = {
      query,
      sources,
      location,
      ...filters,
      ...(forceRefresh ? { forceRefresh: true } : {}),
      ...(demo ? { demo: true } : {}),
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    };

    const resp = await fetch(`${this.baseURL}${ENDPOINTS.SEARCH_STREAM}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || `Search failed: ${resp.status}`);
    }

    const reader = resp.body?.getReader();
    if (!reader) throw new Error("No response stream");

    const decoder = new TextDecoder();
    let buffer = "";
    let result: SearchResponse | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;

        try {
          const event = JSON.parse(trimmed.slice(6));

          if (event.stage === "done") {
            result = event.data as SearchResponse;
          } else if (event.stage === "partial") {
            onPartial?.(event.data as SearchResponse, event.source as string | undefined);
          } else if (event.stage === "error") {
            throw new Error(event.message || "Search failed");
          } else if (onProgress) {
            onProgress(event as SearchProgress);
          }
        } catch (e) {
          if (e instanceof Error && e.message !== "Search failed") continue;
          throw e;
        }
      }
    }

    if (!result) throw new Error("No search result received");
    return result;
  }

  async loadPage(
    cacheKey: string,
    page: number,
    sortBy?: string,
  ): Promise<SearchResponse> {
    return this.post(
      ENDPOINTS.SEARCH_PAGE,
      { cache_key: cacheKey, page, page_size: 30, sort_by: sortBy },
      { headers: getAuthHeader() },
    ).then((r) => r.data);
  }

  async getDetail(url: string): Promise<JobDetail> {
    if (url === DEMO_JOB_URL) return DEMO_JOB_DETAIL;
    return this.post(ENDPOINTS.JOB_DETAILS, { url }).then((r) => r.data);
  }

  async getCredits(): Promise<{ credits: number; max_credits: number }> {
    return this.get(ENDPOINTS.CREDITS, {}, { headers: getAuthHeader() }).then((r) => r.data);
  }
}

export const jobsService = new JobsService();
