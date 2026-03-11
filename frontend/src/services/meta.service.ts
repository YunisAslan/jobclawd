import { APIService } from "@/services/api.service";
import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";
import { MetaFiltersResponse } from "@/components/feed/types";

class MetaService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getFilters(): Promise<MetaFiltersResponse> {
    return this.get(ENDPOINTS.META_FILTERS).then((r) => r.data);
  }
}

export const metaService = new MetaService();
