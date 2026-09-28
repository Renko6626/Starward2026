import { afterEach, describe, expect, it, vi } from "vitest";
import {
  enforceApplicationSubmissionGuards,
  resolveClientIpAddress,
} from "./application-submission-guards";
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

function headersFrom(values: Record<string, string>) {
  return (name: string) => values[name.toLowerCase()] ?? null;
}

describe("resolveClientIpAddress", () => {
  it("uses cf-connecting-ip on the cloudflare runtime", () => {
    expect(
      resolveClientIpAddress({
        runtime: "cloudflare",
        header: headersFrom({ "cf-connecting-ip": "203.0.113.9" }),
      }),
    ).toBe("203.0.113.9");
  });

  it("ignores forwarded headers for direct node clients by default", () => {
    expect(
      resolveClientIpAddress({
        runtime: "node",
        header: headersFrom({
          "cf-connecting-ip": "203.0.113.9",
          "x-forwarded-for": "203.0.113.8",
        }),
        remoteAddress: "198.51.100.7",
      }),
    ).toBe("198.51.100.7");
  });

  it("uses the last forwarded hop only when the peer is an explicitly trusted proxy", () => {
    expect(
      resolveClientIpAddress({
        runtime: "node",
        header: headersFrom({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }),
        remoteAddress: "198.51.100.7",
        trustProxyHeaders: true,
        trustedProxyIps: ["198.51.100.7"],
      }),
    ).toBe("203.0.113.9");
  });

  it("keeps ignoring forwarded headers when trust is enabled but the peer is unknown", () => {
    expect(
      resolveClientIpAddress({
        runtime: "node",
        header: headersFrom({ "x-forwarded-for": "203.0.113.9" }),
        remoteAddress: "203.0.113.100",
        trustProxyHeaders: true,
        trustedProxyIps: ["198.51.100.7"],
      }),
    ).toBe("203.0.113.100");
  });

  it("returns null rather than trusting headers when no remote address is available", () => {
    expect(
      resolveClientIpAddress({
        runtime: "node",
        header: headersFrom({ "cf-connecting-ip": "203.0.113.9" }),
        remoteAddress: null,
      }),
    ).toBeNull();
  });

  it("normalizes an IPv4-mapped IPv6 peer so it matches an IPv4 trusted proxy", () => {
    expect(
      resolveClientIpAddress({
        runtime: "node",
        header: headersFrom({ "x-forwarded-for": "203.0.113.9" }),
        remoteAddress: "::ffff:198.51.100.7",
        trustProxyHeaders: true,
        trustedProxyIps: ["198.51.100.7"],
      }),
    ).toBe("203.0.113.9");
  });
});

describe("enforceApplicationSubmissionGuards client ip trust", () => {
  it("keys the ip limiter by the node socket address, not a spoofed header", async () => {
    const ipLimiter = createLimiter(true);
    const ctx = createContext(
      {
        RUNTIME: "node",
        APPLICATION_SUBMIT_IP_RATE_LIMITER: ipLimiter,
        incoming: { socket: { remoteAddress: "198.51.100.7" } },
      },
      { "cf-connecting-ip": "203.0.113.9" },
    );

    const result = await enforceApplicationSubmissionGuards(ctx, { contactEmail: null });

    expect(result).toEqual({ ok: true });
    expect(ipLimiter.limit).toHaveBeenCalledWith({ key: "apply:ip:198.51.100.7" });
  });
});
