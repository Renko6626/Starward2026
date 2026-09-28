import { describe, expect, it } from "vitest";
import { createNodeRateLimiter } from "./rate-limit";
import { limitApplicationSubmission } from "../worker/lib/application-rate-limit";

describe("createNodeRateLimiter", () => {
  it("allows up to the configured count inside a window and denies the next request", async () => {
    const limiter = createNodeRateLimiter({ limit: 2, windowMs: 1000, now: () => 0 });

    await expect(limiter.limit({ key: "apply:ip:203.0.113.10" })).resolves.toEqual({
      success: true,
    });
    await expect(limiter.limit({ key: "apply:ip:203.0.113.10" })).resolves.toEqual({
      success: true,
    });
    await expect(limiter.limit({ key: "apply:ip:203.0.113.10" })).resolves.toEqual({
      success: false,
    });
  });

  it("resets a bucket after the window elapses", async () => {
    let now = 0;
    const limiter = createNodeRateLimiter({ limit: 1, windowMs: 1000, now: () => now });

    await expect(limiter.limit({ key: "apply:email:alice@example.com" })).resolves.toEqual({
      success: true,
    });
    await expect(limiter.limit({ key: "apply:email:alice@example.com" })).resolves.toEqual({
      success: false,
    });

    now = 1000;

    await expect(limiter.limit({ key: "apply:email:alice@example.com" })).resolves.toEqual({
      success: true,
    });
  });

  it("tracks each key independently so ip and email buckets do not share capacity", async () => {
    const limiter = createNodeRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 });

    await expect(limiter.limit({ key: "apply:ip:203.0.113.10" })).resolves.toEqual({
      success: true,
    });
    await expect(limiter.limit({ key: "apply:email:alice@example.com" })).resolves.toEqual({
      success: true,
    });
    await expect(limiter.limit({ key: "apply:ip:203.0.113.10" })).resolves.toEqual({
      success: false,
    });
  });

  it("no-ops when limits are disabled", async () => {
    const limiter = createNodeRateLimiter({ limit: 0, windowMs: 1000, now: () => 0 });

    for (let attempt = 0; attempt < 25; attempt += 1) {
      await expect(limiter.limit({ key: "apply:ip:203.0.113.10" })).resolves.toEqual({
        success: true,
      });
    }
  });

  it("plugs into the existing application submission rate-limit contract", async () => {
    const limiter = createNodeRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 });

    await expect(
      limitApplicationSubmission({
        emailRateLimiter: limiter,
        contactEmail: "  Alice@Example.com ",
      }),
    ).resolves.toEqual({ ok: true });

    await expect(
      limitApplicationSubmission({
        emailRateLimiter: limiter,
        contactEmail: "alice@example.com",
      }),
    ).resolves.toEqual({
      ok: false,
      code: "application_submit_rate_limited",
      message: "该邮箱短时间内提交过于频繁，请稍后再试。",
      retryAfterSeconds: 60,
    });
  });
});
