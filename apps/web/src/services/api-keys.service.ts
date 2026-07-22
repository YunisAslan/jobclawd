import { APIService } from "@/services/api.service";
import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";

function getAuthHeader(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const match = document.cookie.match(/(?:^|; )jc_token=([^;]*)/);
  const token = match ? decodeURIComponent(match[1]) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface ApiKeyStatus {
  has_key: boolean;
  key_hint: string | null;
}

class ApiKeysService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  getStatus(): Promise<ApiKeyStatus> {
    return this.get(ENDPOINTS.OPENAI_KEY, {}, { headers: getAuthHeader() }).then((r) => r.data);
  }

  saveKey(key: string): Promise<ApiKeyStatus> {
    return this.put(ENDPOINTS.OPENAI_KEY, { key }, { headers: getAuthHeader() }).then((r) => r.data);
  }

  deleteKey(): Promise<ApiKeyStatus> {
    return this.delete(ENDPOINTS.OPENAI_KEY, { headers: getAuthHeader() }).then((r) => r.data);
  }
}

export const apiKeysService = new ApiKeysService();
