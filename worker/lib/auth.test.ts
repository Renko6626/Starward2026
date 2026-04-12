import { describe, expect, it } from "vitest";
import { buildPortalEmailOtpOptions, buildPortalSessionOptions } from "./auth";

describe("buildPortalEmailOtpOptions", () => {
  it("reuses the current OTP when the user requests another code within the validity window", () => {
    const options = buildPortalEmailOtpOptions({});

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
