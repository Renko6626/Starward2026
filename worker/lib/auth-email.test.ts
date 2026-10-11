import { describe, expect, it } from 'vitest';
import { buildPortalOtpEmail } from './auth-email';

describe('OTP email language', () => {
  it('renders the English password reset email and preserves the code and purpose', () => {
    const email = buildPortalOtpEmail({ otp: '123456', type: 'forget-password', siteUrl: 'https://hifuu.moe', language: 'en' });
    expect(email.subject).toBe('Starward Pilgrimage password reset code');
    expect(email.text).toContain('Verification code: 123456');
    expect(email.text).toContain('10 minutes');
    expect(email.text).toContain('https://hifuu.moe/portal/login?reset=password&lang=en');
    expect(email.html).toContain('<html lang="en">');
    expect(email.html).toContain('Do not share this code.');
    expect(email.text + email.html).not.toMatch(/[\u3400-\u9fff]/);
  });

  it('keeps Chinese as the default and escapes untrusted code in HTML', () => {
    const email = buildPortalOtpEmail({ otp: '<&"', type: 'sign-in', siteUrl: 'https://hifuu.moe' });
    expect(email.subject).toContain('邮箱验证码');
    expect(email.html).toContain('<html lang="zh-CN">');
    expect(email.html).toContain('&lt;&amp;&quot;');
    expect(email.html).not.toContain('验证码 <&"');
  });
});
