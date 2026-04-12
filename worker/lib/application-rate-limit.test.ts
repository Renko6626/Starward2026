import { describe, expect, it, vi } from "vitest";
import { limitApplicationSubmission } from "./application-rate-limit";

function createLimiter(success: boolean) {
  return {
    limit: vi.fn().mockResolvedValue({ success }),
  };
}

describe("limitApplicationSubmission", () => {
  it("allows requests when no rate limit bindings are configured", async () => {
    await expect(
      limitApplicationSubmission({
        ipAddress: "203.0.113.10",
        contactEmail: "alice@example.com",
      }),
    ).resolves.toEqual({ ok: true });
  });

  it("rejects when the coarse IP limiter is exhausted", async () => {
    const ipLimiter = createLimiter(false);

    await expect(
      limitApplicationSubmission({
        ipRateLimiter: ipLimiter,
        ipAddress: "203.0.113.10",
        contactEmail: "alice@example.com",
      }),
    ).resolves.toEqual({
      ok: false,
      code: "application_submit_rate_limited",
      message: "报名提交过于频繁，请稍后再试。",
      retryAfterSeconds: 60,
    });

    expect(ipLimiter.limit).toHaveBeenCalledWith({
      key: "apply:ip:203.0.113.10",
    });
  });

  it("rejects when the per-email limiter is exhausted", async () => {
    const ipLimiter = createLimiter(true);
    const emailLimiter = createLimiter(false);

    await expect(
      limitApplicationSubmission({
        ipRateLimiter: ipLimiter,
        emailRateLimiter: emailLimiter,
        ipAddress: "203.0.113.10",
        contactEmail: "  Alice@Example.com ",
      }),
    ).resolves.toEqual({
      ok: false,
      code: "application_submit_rate_limited",
      message: "该邮箱短时间内提交过于频繁，请稍后再试。",
      retryAfterSeconds: 60,
    });

    expect(emailLimiter.limit).toHaveBeenCalledWith({
      key: "apply:email:alice@example.com",
    });
  });

  it("allows requests when both configured limiters still have capacity", async () => {
    const ipLimiter = createLimiter(true);
    const emailLimiter = createLimiter(true);

    await expect(
      limitApplicationSubmission({
        ipRateLimiter: ipLimiter,
        emailRateLimiter: emailLimiter,
        ipAddress: "203.0.113.10",
        contactEmail: "alice@example.com",
      }),
    ).resolves.toEqual({ ok: true });
  });
});
