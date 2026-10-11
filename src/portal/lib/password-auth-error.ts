import { getTurnstileErrorMessage } from '../../shared/turnstile';
import { localizeSystemLabel, type SiteLanguage } from '../../shared/i18n';
import { authMessages } from '../../i18n/locales/portal-auth';

type AuthError = { code?: string; message?: string; status?: number };

const errorKeys: Record<string, keyof typeof authMessages> = {
  INVALID_PASSWORD_LENGTH: 'auth.error.passwordLength',
  OTP_REGISTRATION_REQUIRED: 'auth.error.otpRegistration',
  OTP_SEND_UNAVAILABLE: 'auth.error.otpUnavailable',
  OTP_SEND_FAILED: 'auth.otp.sendFailed',
  ACTIVITY_RULES_REQUIRED: 'auth.error.rulesRequired',
  ACTIVITY_RULES_CHANGED: 'auth.error.rulesChanged',
  ACTIVITY_RULES_SAVE_FAILED: 'auth.error.rulesSaveFailed',
  WORKSPACE_SETUP_FAILED: 'auth.error.workspaceFailed',
  RESERVED_AUTH_EMAIL: 'auth.error.reservedEmail',
  QQ_ONLY_ACCOUNT: 'auth.error.qqOnly',
  EMAIL_NOT_VERIFIED: 'auth.error.emailNotVerified',
  INVALID_EMAIL_OR_PASSWORD: 'auth.error.credentials',
  INVALID_PASSWORD: 'auth.error.password',
  PASSWORD_TOO_SHORT: 'auth.error.passwordShort',
  PASSWORD_TOO_LONG: 'auth.error.passwordLong',
  INVALID_EMAIL: 'auth.error.email',
  INVALID_OTP: 'auth.error.otp',
  OTP_EXPIRED: 'auth.error.otpExpired',
  TOO_MANY_ATTEMPTS: 'auth.error.attempts',
  TOO_MANY_REQUESTS: 'auth.error.rateLimit',
  USER_NOT_FOUND: 'auth.error.userMissing',
  USER_ALREADY_EXISTS: 'auth.error.userExists',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'auth.error.userExists',
  PASSWORD_ALREADY_SET: 'auth.error.passwordAlreadySet',
  SESSION_EXPIRED: 'auth.error.sessionExpired',
  UNAUTHORIZED: 'auth.error.sessionExpired',
};

/** Adapt known authentication errors only; user-entered data is never translated. */
export function getAuthErrorMessage(error: AuthError, language: SiteLanguage = 'zh-CN', fallback = '') {
  const verificationError = getTurnstileErrorMessage(error, language);
  if (verificationError) return verificationError;
  const key = error.code ? errorKeys[error.code] : undefined;
  if (key) return authMessages[key][language === 'en' ? 'en' : 'zh'];
  if (error.status === 429) return authMessages['auth.error.rateLimit'][language === 'en' ? 'en' : 'zh'];
  if (error.message) {
    const message = localizeSystemLabel(error.message, language);
    // Unknown untranslated Chinese auth errors must still be actionable in English.
    if (language === 'zh-CN' || !/\p{Script=Han}/u.test(message)) return message;
  }
  return fallback || authMessages['auth.error.generic'][language === 'en' ? 'en' : 'zh'];
}

export function getPasswordAuthErrorMessage(error: AuthError, language: SiteLanguage = 'zh-CN') {
  return getAuthErrorMessage(error, language);
}
