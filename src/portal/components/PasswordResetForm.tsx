import { useSiteTranslation } from "../../i18n/use-site-translation";
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Field, Notice } from '../../app/components/ui';
import { authClient } from '../lib/auth-client';
import { PORTAL_EMAIL_OTP_LENGTH, getPortalEmailOtpResendCooldownText, normalizePortalEmailOtpInput } from '../../shared/email-otp';
import type { TurnstileVerificationState } from '../../app/components/use-turnstile';
import { getAuthErrorMessage } from '../lib/password-auth-error';

export function PasswordResetForm({ initialEmail, cooldownSeconds, onCooldown, onBusyChange, onComplete, onCancel, verification }: {
  verification: TurnstileVerificationState;
  initialEmail: string;
  cooldownSeconds: number;
  onCooldown: () => void;
  onBusyChange: (busy: boolean) => void;
  onComplete: (email: string) => void;
  onCancel: () => void;
}) {
  const { t, language, label } = useSiteTranslation();
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setEmail(current => current || initialEmail); }, [initialEmail]);

  async function sendCode() {
    if (!verification.ready) { setError(t("auth.verification.required")); return; }
    setBusy(true); onBusyChange(true); setError(null);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await authClient.emailOtp.requestPasswordReset({ email: normalizedEmail }, { headers: verification.headers });
      if (response.error) {
        if (response.error.status === 429) onCooldown();
        setError(getAuthErrorMessage(response.error, language, t("auth.otp.sendFailed")));
        return;
      }
      setEmail(normalizedEmail); setSent(true); onCooldown();
    } catch { setError(t("auth.otp.unavailable")); }
    finally { verification.reset(); setBusy(false); onBusyChange(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sent) { await sendCode(); return; }
    if (otp.length !== PORTAL_EMAIL_OTP_LENGTH) { setError(t("auth.reset.otpLength")); return; }
    setBusy(true); onBusyChange(true); setError(null);
    try {
      const response = await authClient.emailOtp.resetPassword({ email, otp, password });
      if (response.error) { setError(getAuthErrorMessage(response.error, language, t("auth.reset.failed"))); return; }
      setPassword(''); setOtp(''); onComplete(email);
    } catch { setError(t("auth.reset.unavailable")); }
    finally { setBusy(false); onBusyChange(false); }
  }

  return <>
    <form onSubmit={submit}>
      <Field label={t("auth.field.email")}><input className="field-input" type="email" required maxLength={320} autoComplete="username" value={email} readOnly={sent} disabled={busy} placeholder="you@example.com" onChange={event => setEmail(event.target.value)} /></Field>
      {sent ? <>
        <p className="auth-note">{t("auth.reset.sentNotice", { email })}</p>
        <Field label={t("auth.reset.code")}><input className="field-input" type="text" required inputMode="numeric" autoComplete="one-time-code" maxLength={PORTAL_EMAIL_OTP_LENGTH} value={otp} disabled={busy} placeholder={t("auth.otp.placeholder")} onChange={event => setOtp(normalizePortalEmailOtpInput(event.target.value))} /></Field>
        <Field label={t("auth.password.new")}><input className="field-input" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} disabled={busy} placeholder={t("auth.password.placeholderNew")} onChange={event => setPassword(event.target.value)} /></Field>
      </> : <p className="auth-note">{t("auth.reset.emailHelp")}</p>}
      {!sent ? verification.node : null}
      <Button appearance="framed" className="button--accent" type="submit" disabled={busy || (!sent && (!verification.ready || cooldownSeconds > 0))} aria-busy={busy}>
        {busy ? t("auth.actions.submitting") : sent ? t("auth.actions.resetPassword") : cooldownSeconds > 0 ? getPortalEmailOtpResendCooldownText(cooldownSeconds, language) : t("auth.actions.sendReset")}
      </Button>
      {sent ? verification.node : null}
      {sent ? <Button appearance="industrial" variant="secondary" type="button" disabled={busy || !verification.ready || cooldownSeconds > 0} onClick={() => void sendCode()}>{cooldownSeconds > 0 ? getPortalEmailOtpResendCooldownText(cooldownSeconds, language) : t("auth.actions.resend")}</Button> : null}
      {sent ? <button type="button" className="auth-note" disabled={busy} onClick={() => { verification.reset(); setSent(false); setOtp(''); setPassword(''); setError(null); }}>{t("auth.actions.otherEmail")}</button> : null}
      <button type="button" className="auth-otp-toggle" disabled={busy} onClick={onCancel}>{t("auth.actions.passwordReturn")}</button>
    </form>
    {error ? <Notice tone="error">{label(error)}</Notice> : null}
  </>;
}
