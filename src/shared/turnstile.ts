export const AUTH_CAPTCHA_HEADER = 'x-captcha-response';
export function getTurnstileErrorMessage(error: { code?: string; message?: string }) {
  if (error.code === 'MISSING_RESPONSE' || error.code === 'VERIFICATION_FAILED') return '人机验证未通过，请重新验证后再试。';
  if (error.code === 'UNKNOWN_ERROR' && error.message === 'Something went wrong') return '人机验证服务暂不可用，请稍后重试。';
  return null;
}
export const TURNSTILE_AUTH_ENDPOINTS = [
  '/email-otp/send-verification-otp',
  '/email-otp/request-password-reset',
  '/sign-in/email',
];

export type PublicAuthProvidersResponse = {
  qq: { enabled: boolean };
  turnstile: { enabled: boolean };
};
