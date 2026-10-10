import { APIError } from 'better-auth/api';
import type { GenericEndpointContext } from 'better-auth';
import type { AppBindings } from './types';

export async function limitAuthOtpSend(env: AppBindings, context: GenericEndpointContext, email: string) {
  const ip = context.headers?.get('cf-connecting-ip') ?? context.request?.headers.get('cf-connecting-ip')
    ?? (env.ALLOW_LOCAL_DEV_ORIGINS === 'true' ? '127.0.0.1' : null);
  if (!env.AUTH_OTP_IP_RATE_LIMITER || !env.AUTH_OTP_EMAIL_RATE_LIMITER || !ip) {
    throw new APIError('SERVICE_UNAVAILABLE', { code: 'AUTH_RATE_LIMIT_UNAVAILABLE', message: '验证码服务暂时不可用，请稍后再试。' });
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email));
  const emailKey = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const ipLimit = await env.AUTH_OTP_IP_RATE_LIMITER.limit({ key: `auth:otp:ip:${ip}` });
  const emailLimit = ipLimit.success && await env.AUTH_OTP_EMAIL_RATE_LIMITER.limit({ key: `auth:otp:email:${emailKey}` });
  if (!emailLimit || !emailLimit.success) {
    throw new APIError('TOO_MANY_REQUESTS', { code: 'AUTH_OTP_RATE_LIMITED', message: '验证码请求过于频繁，请在 60 秒后重试。' }, { 'Retry-After': '60', 'X-Retry-After': '60' });
  }
}
