import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";
import { APIService } from "./api.service";

export interface FeedbackPayload {
  message: string;
  email?: string;
}

class FeedbackService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  submit(payload: FeedbackPayload) {
    return this.post(ENDPOINTS.FEEDBACK, payload);
  }
}

export const feedbackService = new FeedbackService();
