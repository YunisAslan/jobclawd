import { APIService } from "@/services/api.service";
import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";

function getAuthHeader(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const match = document.cookie.match(/(?:^|; )jc_token=([^;]*)/);
  const token = match ? decodeURIComponent(match[1]) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

class AuthService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async sendMagicLink(email: string): Promise<void> {
    return this.post(ENDPOINTS.SEND_MAGIC_LINK, { email }).then((r) => r.data);
  }

  async verifyMagicLink(
    token: string,
  ): Promise<{ access_token: string; user: { email: string; name: string } }> {
    return this.post(ENDPOINTS.VERIFY_MAGIC_LINK, { token }).then((r) => r.data);
  }

  async deleteAccount(): Promise<void> {
    return this.delete(ENDPOINTS.DELETE_ACCOUNT, {
      headers: getAuthHeader(),
    }).then((r) => r.data);
  }
}

export const authService = new AuthService();
