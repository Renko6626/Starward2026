import { afterEach, describe, expect, it, vi } from "vitest";
import { enforceApplicationSubmissionGuards } from "./application-submission-guards";
import type { AppContext } from "./types";

type FakeEnv = Record<string, unknown>;

function createContext(env: FakeEnv, headers: Record<string, string> = {}): AppContext {
  return {
    env,
    req: {
      header: (name: string) => headers[name.toLowerCase()],
    },
  } as unknown as AppContext;
}

function createLimiter(success: boolean) {
  return {
    limit: vi.fn().mockResolvedValue({ success }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("enforceApplicationSubmissionGuards", () => {
  it("rejects with 429 when the IP rate limiter is exhausted", async () => {
    const ctx = createContext(
      {
        APPLICATION_SUBMIT_IP_RATE_LIMITER: createLimiter(false),
      },
      { "cf-connecting-ip": "203.0.113.10" },
    );

    const result = await enforceApplicationSubmissionGuards(ctx, {
      contactEmail: "alice@example.com",
      turnstileToken: undefined,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(429);
      expect(result.code).toBe("application_submit_rate_limited");
    }
  });

  it("rejects when Turnstile is configured but the token is invalid", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const ctx = createContext(
      {
        TURNSTILE_SECRET_KEY: "secret",
      },
      { "cf-connecting-ip": "203.0.113.10" },
    );

    const result = await enforceApplicationSubmissionGuards(ctx, {
      contactEmail: "alice@example.com",
      turnstileToken: "bad-token",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBeGreaterThanOrEqual(400);
      expect(result.status).toBeLessThan(500);
    }
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects when Turnstile is configured but the token is missing", async () => {
    const ctx = createContext({ TURNSTILE_SECRET: "secret" });

    const result = await enforceApplicationSubmissionGuards(ctx, {
      contactEmail: "alice@example.com",
      turnstileToken: undefined,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("passes through when neither anti-abuse mechanism is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const ctx = createContext({}, { "cf-connecting-ip": "203.0.113.10" });

    const result = await enforceApplicationSubmissionGuards(ctx, {
      contactEmail: "alice@example.com",
      turnstileToken: undefined,
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
