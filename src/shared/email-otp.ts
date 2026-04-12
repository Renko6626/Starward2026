export const PORTAL_EMAIL_OTP_EXPIRES_IN_SECONDS = 60 * 10;
export const PORTAL_EMAIL_OTP_ALLOWED_ATTEMPTS = 3;
export const PORTAL_EMAIL_OTP_RATE_LIMIT_WINDOW_SECONDS = 60;
export const PORTAL_EMAIL_OTP_RATE_LIMIT_MAX = 3;
export const PORTAL_EMAIL_OTP_RESEND_COOLDOWN_SECONDS = 30;
export const PORTAL_EMAIL_OTP_RESEND_STRATEGY = "reuse" as const;
export const PORTAL_EMAIL_OTP_STORE_MODE = "plain" as const;

export function getPortalEmailOtpValidityLabel() {
  return `${PORTAL_EMAIL_OTP_EXPIRES_IN_SECONDS / 60} 分钟`;
}

export function getPortalEmailOtpNoticeText() {
  return `访问码已发送至您的邮箱，${getPortalEmailOtpValidityLabel()}内有效。`;
}

export function getPortalEmailOtpResendSuccessMessage(email: string) {
  return `已重新发送当前有效验证码到 ${email}。`;
}

export function getPortalEmailOtpResendCooldownText(secondsRemaining: number) {
  return `${secondsRemaining}s 后可重新发送`;
}
