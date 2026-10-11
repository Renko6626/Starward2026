import { useEffect, useState, type FormEvent } from 'react';
import { Button, Field, Notice } from '../../app/components/ui';
import { authClient } from '../lib/auth-client';
import { PORTAL_EMAIL_OTP_LENGTH, getPortalEmailOtpResendCooldownText, normalizePortalEmailOtpInput } from '../../shared/email-otp';
import type { TurnstileVerificationState } from '../../app/components/use-turnstile';
import { getTurnstileErrorMessage } from '../../shared/turnstile';

export function PasswordResetForm({ initialEmail, cooldownSeconds, onCooldown, onBusyChange, onComplete, onCancel, verification }: {
  verification: TurnstileVerificationState;
  initialEmail: string;
  cooldownSeconds: number;
  onCooldown: () => void;
  onBusyChange: (busy: boolean) => void;
  onComplete: (email: string) => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setEmail(current => current || initialEmail); }, [initialEmail]);

  async function sendCode() {
    if (!verification.ready) { setError('请先完成人机验证。'); return; }
    setBusy(true); onBusyChange(true); setError(null);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await authClient.emailOtp.requestPasswordReset({ email: normalizedEmail }, { headers: verification.headers });
      if (response.error) {
        if (response.error.status === 429) onCooldown();
        setError(getTurnstileErrorMessage(response.error) || response.error.message || '验证码发送失败，请稍后重试。');
        return;
      }
      setEmail(normalizedEmail); setSent(true); onCooldown();
    } catch { setError('暂时无法发送验证码，请稍后重试。'); }
    finally { verification.reset(); setBusy(false); onBusyChange(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sent) { await sendCode(); return; }
    if (otp.length !== PORTAL_EMAIL_OTP_LENGTH) { setError('请输入 6 位重置验证码。'); return; }
    setBusy(true); onBusyChange(true); setError(null);
    try {
      const response = await authClient.emailOtp.resetPassword({ email, otp, password });
      if (response.error) { setError(response.error.message || '密码重置失败，请检查验证码。'); return; }
      setPassword(''); setOtp(''); onComplete(email);
    } catch { setError('暂时无法重置密码，请稍后重试。'); }
    finally { setBusy(false); onBusyChange(false); }
  }

  return <>
    <form onSubmit={submit}>
      <Field label="登录邮箱"><input className="field-input" type="email" required maxLength={320} autoComplete="username" value={email} readOnly={sent} disabled={busy} placeholder="you@example.com" onChange={event => setEmail(event.target.value)} /></Field>
      {sent ? <>
        <p className="auth-note">若该邮箱已注册，重置验证码将发送至 {email}，10 分钟内有效。</p>
        <Field label="重置验证码"><input className="field-input" type="text" required inputMode="numeric" autoComplete="one-time-code" maxLength={PORTAL_EMAIL_OTP_LENGTH} value={otp} disabled={busy} placeholder="输入 6 位验证码" onChange={event => setOtp(normalizePortalEmailOtpInput(event.target.value))} /></Field>
        <Field label="新密码"><input className="field-input" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} disabled={busy} placeholder="设置 8–128 位密码" onChange={event => setPassword(event.target.value)} /></Field>
      </> : <p className="auth-note">输入注册账号时使用的邮箱，我们会向已注册的邮箱发送重置验证码。</p>}
      {!sent ? verification.node : null}
      <Button appearance="framed" className="button--accent" type="submit" disabled={busy || (!sent && (!verification.ready || cooldownSeconds > 0))} aria-busy={busy}>
        {busy ? '提交中…' : sent ? '重置密码' : cooldownSeconds > 0 ? getPortalEmailOtpResendCooldownText(cooldownSeconds) : '发送重置验证码'}
      </Button>
      {sent ? verification.node : null}
      {sent ? <Button appearance="industrial" variant="secondary" type="button" disabled={busy || !verification.ready || cooldownSeconds > 0} onClick={() => void sendCode()}>{cooldownSeconds > 0 ? getPortalEmailOtpResendCooldownText(cooldownSeconds) : '重新发送验证码'}</Button> : null}
      {sent ? <button type="button" className="auth-note" disabled={busy} onClick={() => { verification.reset(); setSent(false); setOtp(''); setPassword(''); setError(null); }}>使用其他邮箱</button> : null}
      <button type="button" className="auth-otp-toggle" disabled={busy} onClick={onCancel}>返回密码登录</button>
    </form>
    {error ? <Notice tone="error">{error}</Notice> : null}
  </>;
}
