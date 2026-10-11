import type { SiteLanguage } from './i18n';
export const AUTH_CAPTCHA_HEADER = 'x-captcha-response';
export function getTurnstileErrorMessage(error: { code?: string; message?: string }, language: SiteLanguage = 'zh-CN') {
  if (error.code === 'MISSING_RESPONSE' || error.code === 'VERIFICATION_FAILED') return language === 'en' ? 'Verification failed. Please verify again and retry.' : '人机验证未通过，请重新验证后再试。';
  if (error.code === 'UNKNOWN_ERROR' && error.message === 'Something went wrong') return language === 'en' ? 'The verification service is unavailable. Please try again later.' : '人机验证服务暂不可用，请稍后重试。';
  return null;
}
export const TURNSTILE_AUTH_ENDPOINTS = [
  '/email-otp/send-verification-otp',
  '/email-otp/request-password-reset',
  // Password sign-in temporarily skips Turnstile while regional access is unreliable.
];

export type PublicAuthProvidersResponse = {
  qq: { enabled: boolean };
  turnstile: { enabled: boolean };
};
