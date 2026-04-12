import { describe, expect, it } from "vitest";
import {
  PORTAL_EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
  getPortalEmailOtpNoticeText,
  getPortalEmailOtpResendCooldownText,
  getPortalEmailOtpResendSuccessMessage,
} from "./email-otp";

describe("portal email otp copy", () => {
  it("uses the same ten-minute validity copy as the backend email", () => {
    expect(getPortalEmailOtpNoticeText()).toBe("访问码已发送至您的邮箱，10 分钟内有效。");
  });

  it("treats resend as sending the current valid code again", () => {
    expect(getPortalEmailOtpResendSuccessMessage("help_bot@outlook.com")).toBe(
      "已重新发送当前有效验证码到 help_bot@outlook.com。",
    );
    expect(getPortalEmailOtpResendCooldownText(PORTAL_EMAIL_OTP_RESEND_COOLDOWN_SECONDS)).toBe(
      "30s 后可重新发送",
    );
  });
});
