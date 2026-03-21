import { APIService } from "@/services/api.service";
import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";
import { ScreeningAnswer } from "@/types";

class ScreeningService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getAnswers(): Promise<ScreeningAnswer[]> {
    return this.get(ENDPOINTS.SCREENING_ANSWERS, {}).then((r) => r.data.answers);
  }

  async upsertAnswer(question: string, answer: string): Promise<ScreeningAnswer> {
    return this.post(ENDPOINTS.SCREENING_ANSWERS, { question, answer }).then((r) => r.data);
  }

  async deleteAnswer(id: number): Promise<void> {
    return this.delete(`${ENDPOINTS.SCREENING_ANSWERS}/${id}`).then(() => undefined);
  }
}

export const screeningService = new ScreeningService();
