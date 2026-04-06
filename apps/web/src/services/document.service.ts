import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";
import { APIService } from "@/services/api.service";
import type { CVData, DocumentSession } from "@/types";

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

  async createSession(cv_url: string): Promise<DocumentSession> {
    const res = await this.post(
      ENDPOINTS.DOCUMENT_SESSION,
      { cv_url },
      { headers: getAuthHeader(), timeout: 30000 },
    );
    return res.data;
  }

  async getSession(session_id: string): Promise<DocumentSession> {
    const res = await this.get(
      `${ENDPOINTS.DOCUMENT_SESSION}/${session_id}`,
      {},
      { headers: getAuthHeader() },
    );
    return res.data;
  }

  async convertToDocx(session_id: string): Promise<DocumentSession> {
    const res = await this.post(
      ENDPOINTS.DOCUMENT_CONVERT,
      { session_id },
      { headers: getAuthHeader(), timeout: 120000 },
    );
    return res.data;
  }

  async pollConversionDone(session_id: string, intervalMs = 2000, maxMs = 120000): Promise<DocumentSession> {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      const session = await this.getSession(session_id);
      if (session.conversion_status === "done" || session.conversion_status === "failed") {
        return session;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error("Conversion timed out.");
  }

  async extractHtml(session_id: string): Promise<{ html: string; cv_name: string }> {
    const res = await this.get(
      `${ENDPOINTS.DOCUMENT_EXTRACT_HTML}/${session_id}`,
      {},
      { headers: getAuthHeader() },
    );
    return res.data;
  }

  async downloadExport(session_id: string, filename: string): Promise<void> {
    const res = await this.get(
      `${ENDPOINTS.DOCUMENT_EXPORT}/${session_id}`,
      {},
      { headers: getAuthHeader(), responseType: "blob" },
    );
    const blob = new Blob([res.data]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async parseCv(cv_url: string): Promise<{ data: CVData; cv_name: string }> {
    const res = await this.post(
      ENDPOINTS.DOCUMENT_PARSE,
      { cv_url },
      { headers: getAuthHeader(), timeout: 30000 },
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

  exportUrl(session_id: string): string {
    return `${API_BASE_URL}${ENDPOINTS.DOCUMENT_EXPORT}/${session_id}`;
  }
}

export const documentService = new DocumentService();
