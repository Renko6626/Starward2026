import { describe, expect, it } from "vitest";
import {
  buildPortalEmailOtpOptions,
  buildPortalSessionOptions,
  buildPortalTrustedOrigins,
} from "./auth";

describe("buildPortalEmailOtpOptions", () => {
  it("reuses the current OTP when the user requests another code within the validity window", () => {
    const options = buildPortalEmailOtpOptions({});

    expect(options.otpLength).toBe(6);
    expect(options.storeOTP).toBe("plain");
    expect(options.resendStrategy).toBe("reuse");
    expect(options.expiresIn).toBe(60 * 10);
    expect(options.allowedAttempts).toBe(3);
    expect(options.rateLimit).toEqual({
      window: 60,
      max: 3,
    });
  });
});

describe("buildPortalSessionOptions", () => {
  it("uses an explicit long-lived sliding session policy for the participant portal", () => {
    expect(buildPortalSessionOptions()).toEqual({
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    });
  });
});

describe("buildPortalTrustedOrigins", () => {
  it("includes configured base URL and explicit extra origins", async () => {
    const trustedOrigins = buildPortalTrustedOrigins({
      BETTER_AUTH_URL: "http://127.0.0.1:5173/",
      BETTER_AUTH_TRUSTED_ORIGINS: "http://starward.localhost:5173, https://dev.example.com/",
    });

    await expect(trustedOrigins()).resolves.toEqual([
      "http://127.0.0.1:5173",
      "http://starward.localhost:5173",
      "https://dev.example.com",
    ]);
  });

  it("trusts the current local development origin only when local dev origins are explicitly enabled", async () => {
    const trustedOrigins = buildPortalTrustedOrigins({
      BETTER_AUTH_URL: "http://127.0.0.1:4173",
      ALLOW_LOCAL_DEV_ORIGINS: "true",
    });

    const request = new Request("http://localhost:5173/api/auth/email-otp/send-verification-otp", {
      headers: {
        origin: "http://localhost:5173",
      },
    });

    await expect(trustedOrigins(request)).resolves.toEqual([
      "http://127.0.0.1:4173",
      "http://localhost:5173",
    ]);
  });

  it("does not auto-trust local/private-network request origins by default", async () => {
    const trustedOrigins = buildPortalTrustedOrigins({
      BETTER_AUTH_URL: "https://hifuu-staging.ayafeed.com",
    });

    const request = new Request("https://hifuu-staging.ayafeed.com/api/auth/email-otp/send-verification-otp", {
      headers: {
        origin: "http://192.168.1.50:5173",
        referer: "http://localhost:5173/",
      },
    });

    await expect(trustedOrigins(request)).resolves.toEqual([
      "https://hifuu-staging.ayafeed.com",
    ]);
  });

  it("does not trust arbitrary remote origins just because they appear in the request headers", async () => {
    const trustedOrigins = buildPortalTrustedOrigins({
      BETTER_AUTH_URL: "https://hifuu-staging.ayafeed.com",
    });

    const request = new Request("https://hifuu-staging.ayafeed.com/api/auth/email-otp/send-verification-otp", {
      headers: {
        origin: "https://evil.example.com",
      },
    });

    await expect(trustedOrigins(request)).resolves.toEqual([
      "https://hifuu-staging.ayafeed.com",
    ]);
  });
});
