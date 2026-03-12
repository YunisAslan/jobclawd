import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";
import { APIService } from "@/services/api.service";
import { SMTPSettings } from "@/components/settings/types";

export type { SMTPSettings };

function getAuthHeader(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const match = document.cookie.match(/(?:^|; )jc_token=([^;]*)/);
  const token = match ? decodeURIComponent(match[1]) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

class SettingsService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getSMTP(): Promise<SMTPSettings> {
    const res = await this.get(
      ENDPOINTS.SMTP_SETTINGS,
      {},
      {
        headers: getAuthHeader(),
      },
    );
    return res.data;
  }

  async saveSMTP(settings: SMTPSettings): Promise<void> {
    await this.post(ENDPOINTS.SMTP_SETTINGS, settings, {
      headers: getAuthHeader(),
    });
  }

  async deleteSMTP(): Promise<void> {
    await this.delete(ENDPOINTS.SMTP_SETTINGS, {
      headers: getAuthHeader(),
    });
  }
}

export const settingsService = new SettingsService();
