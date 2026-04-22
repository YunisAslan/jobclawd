import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";
import { APIService } from "@/services/api.service";
import { UserProfile } from "@/types";

function getAuthHeader(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const match = document.cookie.match(/(?:^|; )jc_token=([^;]*)/);
  const token = match ? decodeURIComponent(match[1]) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

class ProfileService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getProfile(): Promise<UserProfile> {
    const res = await this.get(
      ENDPOINTS.PROFILE,
      {},
      {
        headers: getAuthHeader(),
      },
    );
    return res.data;
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    await this.post(ENDPOINTS.PROFILE, profile, {
      headers: getAuthHeader(),
    });
  }

  async uploadCV(file: File): Promise<{ name: string; url: string }> {
    const form = new FormData();
    form.append("file", file);
    const res = await this.post(ENDPOINTS.CV_UPLOAD, form, {
      headers: {
        ...getAuthHeader(),
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  }

  async completeOnboarding(): Promise<void> {
    await this.post(ENDPOINTS.COMPLETE_ONBOARDING, {}, { headers: getAuthHeader() });
  }

  async uploadAvatar(file: File): Promise<{ url: string }> {
    const form = new FormData();
    form.append("file", file);
    const res = await this.post(ENDPOINTS.AVATAR_UPLOAD, form, {
      headers: {
        ...getAuthHeader(),
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  }
}

export const profileService = new ProfileService();
