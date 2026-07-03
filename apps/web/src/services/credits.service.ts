import { APIService } from "@/services/api.service";
import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";

function getAuthHeader(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const match = document.cookie.match(/(?:^|; )jc_token=([^;]*)/);
  const token = match ? decodeURIComponent(match[1]) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface CreditBalance {
  credits: number;
  max_credits: number;
}

export interface CreditPlan {
  id: string;
  name: string;
  credits: number;
  price_usd: number;
  popular: boolean;
  description: string;
  checkout_url?: string;
}

export interface WaitlistResult {
  already_registered: boolean;
}

class CreditsService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  getBalance(): Promise<CreditBalance> {
    return this.get(ENDPOINTS.CREDITS, {}, { headers: getAuthHeader() }).then((r) => r.data);
  }

  getPlans(): Promise<{ plans: CreditPlan[] }> {
    return this.get(ENDPOINTS.CREDITS_PLANS, {}, { headers: getAuthHeader() }).then((r) => r.data);
  }

  joinWaitlist(email: string): Promise<WaitlistResult> {
    return this.post(
      ENDPOINTS.CREDITS_WAITLIST,
      { email },
    ).then((r) => r.data);
  }
}

export const creditsService = new CreditsService();
