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
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(429);
      expect(result.code).toBe("application_submit_rate_limited");
    }
  });

  it("keeps account limits even when Turnstile is configured", async () => {
    const limiter = createLimiter(false);
    const ctx = createContext({ TURNSTILE_SECRET_KEY: "secret", APPLICATION_SUBMIT_EMAIL_RATE_LIMITER: limiter });
    const result = await enforceApplicationSubmissionGuards(ctx, { userId: "u1" });
    expect(result).toMatchObject({ ok: false, status: 429 });
    expect(limiter.limit).toHaveBeenCalledWith({ key: "apply:user:u1" });
  });

  it("does not challenge authenticated applications when Turnstile is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await enforceApplicationSubmissionGuards(createContext({ TURNSTILE_SECRET_KEY: "secret" }), { userId: "u1" });
    expect(result).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes through when rate limiting is not configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const ctx = createContext({}, { "cf-connecting-ip": "203.0.113.10" });

    const result = await enforceApplicationSubmissionGuards(ctx, {
      contactEmail: "alice@example.com",
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
