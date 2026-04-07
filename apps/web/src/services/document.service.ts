import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";
import { APIService } from "@/services/api.service";
import type { CVData } from "@/types";

function getAuthHeader(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const match = document.cookie.match(/(?:^|; )jc_token=([^;]*)/);
  const token = match ? decodeURIComponent(match[1]) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

class DocumentService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async parseCv(cv_url: string): Promise<{ data: CVData; cv_name: string }> {
    const res = await this.post(
      ENDPOINTS.DOCUMENT_PARSE,
      { cv_url },
      { headers: getAuthHeader(), timeout: 60000 },
    );
    return res.data;
  }

  async generatePdf(data: CVData, file_name?: string): Promise<void> {
    const res = await this.post(
      ENDPOINTS.DOCUMENT_GENERATE,
      { data, file_name },
      { headers: getAuthHeader(), timeout: 30000, responseType: "blob" },
    );
    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file_name ? `${file_name}.pdf` : "cv.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}

export const documentService = new DocumentService();
