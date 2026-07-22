/**
 * Tiny cross-cutting bridge so the axios layer (outside React) can ask the UI
 * to prompt for an OpenAI API key when the backend responds 403 NO_API_KEY.
 */
type Handler = () => void;

let handler: Handler | null = null;

export function setNoApiKeyHandler(fn: Handler | null) {
  handler = fn;
}

export function emitNoApiKey() {
  handler?.();
}

/** True if an axios error is a backend "no OpenAI key" (403 NO_API_KEY) response. */
export function isNoApiKeyError(error: unknown): boolean {
  const detail = (error as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
  if (detail?.status !== 403) return false;
  const d = detail.data?.detail as { code?: string } | undefined;
  return d?.code === "NO_API_KEY";
}
