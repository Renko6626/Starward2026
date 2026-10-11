import type { SiteLanguage } from './i18n';
export const PORTAL_EMAIL_OTP_EXPIRES_IN_SECONDS = 60 * 10;
export const PORTAL_EMAIL_OTP_LENGTH = 6;
export const PORTAL_EMAIL_OTP_ALLOWED_ATTEMPTS = 3;
export const PORTAL_EMAIL_OTP_RATE_LIMIT_WINDOW_SECONDS = 60;
export const PORTAL_EMAIL_OTP_RATE_LIMIT_MAX = 3;
export const PORTAL_EMAIL_OTP_RESEND_COOLDOWN_SECONDS = 60;
export const PORTAL_PASSWORD_SETUP_HEADER = 'x-starward-password-setup-required';
export const PORTAL_EMAIL_OTP_RESEND_STRATEGY = "reuse" as const;
export const PORTAL_EMAIL_OTP_STORE_MODE = "plain" as const;

export function normalizePortalEmailOtpInput(value: string) {
  return value.replace(/\D/g, "").slice(0, PORTAL_EMAIL_OTP_LENGTH);
}

export function getPortalEmailOtpValidityLabel(language: SiteLanguage = 'zh-CN') {
  const minutes = PORTAL_EMAIL_OTP_EXPIRES_IN_SECONDS / 60;
  return language === 'en' ? `${minutes} minutes` : `${minutes} 分钟`;
}

export function getPortalEmailOtpNoticeText(language: SiteLanguage = 'zh-CN') {
  return language === 'en' ? `A verification code has been sent to your email. It is valid for ${getPortalEmailOtpValidityLabel(language)}.`
    : `访问码已发送至您的邮箱，${getPortalEmailOtpValidityLabel()}内有效。`;
}

export function getPortalEmailOtpResendSuccessMessage(email: string, language: SiteLanguage = 'zh-CN') {
  return language === 'en' ? `The current verification code has been sent again to ${email}.` : `已重新发送当前有效验证码到 ${email}。`;
}

export function getPortalEmailOtpResendCooldownText(secondsRemaining: number, language: SiteLanguage = 'zh-CN') {
  return language === 'en' ? `Resend in ${secondsRemaining}s` : `${secondsRemaining}s 后可重新发送`;
}
