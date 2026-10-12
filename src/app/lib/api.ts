export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const text = await response.text();
  const payload = text ? safeParseJson(text) : null;

  if (!response.ok) {
    if (typeof window !== 'undefined' && typeof input === 'string' && input.startsWith('/api/admin/') && [401, 403].includes(response.status)) {
      window.dispatchEvent(new CustomEvent('admin-access-lost', { detail: response.status }));
    }
    const errorPayload =
      payload &&
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "object" &&
      payload.error !== null
        ? payload.error
        : null;
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

    throw new ApiError(
      response.status,
      message,
      errorPayload && "details" in errorPayload ? errorPayload.details : undefined,
    );
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
