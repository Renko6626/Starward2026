import { getBrowserLanguage } from '../../i18n';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  headers.set('Accept-Language', getBrowserLanguage());
  const response = await fetch(input, { ...init, headers });
  const text = await response.text();
  const payload = text ? safeParseJson(text) : null;

  if (!response.ok) {
    if (typeof window !== 'undefined' && typeof input === 'string' && input.startsWith('/api/admin/') && [401, 403].includes(response.status)) {
      window.dispatchEvent(new CustomEvent('admin-access-lost', { detail: response.status }));
    }
    const message =
      payload &&
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "object" &&
      payload.error &&
      "message" in payload.error &&
      typeof payload.error.message === "string"
        ? payload.error.message
        : response.statusText || "Request failed";

    const error = payload && typeof payload === 'object' && 'error' in payload && payload.error && typeof payload.error === 'object' ? payload.error : null;
    throw new ApiError(response.status, message, error && 'code' in error && typeof error.code === 'string' ? error.code : undefined, error && 'details' in error ? error.details : undefined);
  }

  return payload as T;
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
