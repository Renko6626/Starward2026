import { useSiteTranslation } from "../../i18n/use-site-translation";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Field, Notice } from "../../app/components/ui";
import { requestJson } from "../../app/lib/api";
import {
  PORTAL_EMAIL_OTP_LENGTH,
  PORTAL_EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
  PORTAL_PASSWORD_SETUP_HEADER,
  getPortalEmailOtpValidityLabel,
  getPortalEmailOtpResendCooldownText,
  normalizePortalEmailOtpInput,
} from "../../shared/email-otp";
import type { PortalMeResponse } from "../../shared/portal";
import { getRealAuthEmail } from "../../shared/auth-identity";
import { activityRulesConsentHeaders, NEW_ACCOUNT_RESPONSE_HEADER } from "../../shared/activity-rules";
import { ActivityRulesConsent } from "../components/ActivityRulesConsent";
import { authClient } from "../lib/auth-client";
import { getAuthErrorMessage, getPasswordAuthErrorMessage } from "../lib/password-auth-error";
import { resolvePortalEntryDestination } from "../lib/onboarding";
import { StationTechnicalDrawing } from "../../app/components/StationTechnicalDrawing";
import { PasswordResetForm } from "../components/PasswordResetForm";
import { useTurnstileVerification } from '../../app/components/use-turnstile';
import { type PublicAuthProvidersResponse } from '../../shared/turnstile';
import "./portal-login.css";

export function PortalLoginPage() {
  const { t, language, label } = useSiteTranslation();
  const { segment, reset, returnTo, assisted } = getRouteApi("/portal_/login").useSearch();
  const navigate = useNavigate();
  const sessionQuery = authClient.useSession();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [mode, setMode] = useState<"login" | "register" | "otp" | "reset" | "assisted">(reset === 'password' ? 'reset' : assisted ? 'assisted' : returnTo ? 'login' : 'register');
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "otp" | "password">(assisted && reset !== 'password' ? 'otp' : 'email');
  const [allowEntry, setAllowEntry] = useState(true);
  const [message, setMessage] = useState<string | { key: string; values: Record<string, unknown> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isResolvingDestination, setIsResolvingDestination] = useState(false);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
  const newRegistration = useRef(false);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [turnstileRequired, setTurnstileRequired] = useState<boolean>();
  const verification = useTurnstileVerification(turnstileRequired, step !== 'password' && mode !== 'assisted' && mode !== 'login', `${mode}:${step}`);
  useEffect(() => {
    if (mode === 'assisted' || mode === 'login') return;
    let cancelled = false;
    void requestJson<PublicAuthProvidersResponse>('/api/auth/providers')
      .then(config => { if (!cancelled) setTurnstileRequired(config.turnstile.enabled); })
      .catch(() => { if (!cancelled) setError(t("auth.config.readFailed")); });
    return () => { cancelled = true; };
  }, [mode]);
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code) setError(code.includes("ACTIVITY_RULES_CHANGED")
      ? t("auth.rules.changed")
      : t("auth.login.incomplete"));
  }, []);

  useEffect(() => {
    if (mode === 'reset' || !sessionQuery.data || !allowEntry || (getRealAuthEmail(sessionQuery.data.user.email) && !sessionQuery.data.user.emailVerified)) {
      return;
    }

    let cancelled = false;
    setIsResolvingDestination(true);
    const enter = (state: PortalMeResponse | null) => {
      if (cancelled) return;
      if (returnTo) { window.location.assign(returnTo); return; }
      const destination = resolvePortalEntryDestination(state, { newRegistration: newRegistration.current, segment });
      if (destination === "/works") {
        void navigate({ to: "/works", search: { view: "gallery", type: "all", q: "" } });
      } else {
        void navigate({ to: "/portal", search: { segment }, hash: segment ? "profile" : undefined });
      }
    };

    const user = sessionQuery.data.user;
    void (async () => {
      if (getRealAuthEmail(user.email)) {
        const accounts = await authClient.listAccounts();
        if (cancelled) return;
        if (accounts.error) throw new Error(t("auth.password.readFailed"));
        if (!accounts.data.some(account => account.providerId === 'credential')) {
          setEmail(user.email);
          setStep('password');
          setAllowEntry(false);
          setIsResolvingDestination(false);
          setMessage(t("auth.email.verified"));
          return;
        }
      }
      const state = await requestJson<PortalMeResponse>('/api/portal/me').catch(() => null);
      enter(state);
    })()
      .catch(caught => { if (!cancelled) setError(caught instanceof Error ? label(caught.message) : t("auth.account.readFailed")); })
      .finally(() => {
        if (!cancelled) {
          setIsResolvingDestination(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, sessionQuery.data, segment, returnTo, allowEntry, mode]);

  useEffect(() => {
    if (resendCooldownSeconds <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResendCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [resendCooldownSeconds]);

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSigningIn(true);
    setError(null);
    setMessage(null);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      if (step === "password") {
        const response = await authClient.$fetch('/set-password', { method: 'POST', body: { newPassword: password } });
        if (response.error && (!('code' in response.error) || response.error.code !== 'PASSWORD_ALREADY_SET')) { setError(getAuthErrorMessage(response.error, language, t("auth.password.setFailed"))); return; }
      } else {
        newRegistration.current = false;
        const response = await authClient.signIn.email({ email: normalizedEmail, password });
        if (response.error) {
          setError(getPasswordAuthErrorMessage(response.error, language));
          return;
        }
      }
      setPassword("");
      setAllowEntry(true);
      setIsResolvingDestination(true);
    } catch (caught) {
      setError(caught instanceof Error ? label(caught.message) : t("auth.connection.failed"));
    } finally {
      setIsSigningIn(false);
    }
  }

  async function sendOtp(isResend = false) {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError(t("auth.email.required"));
      return;
    }
    if (mode === "register" && !rulesAccepted) {
      setError(t("auth.rules.required"));
      return;
    }
    if (!verification.ready) { setError(t("auth.verification.required")); return; }

    setIsSending(true);
    setError(null);
    setMessage(null);

    try {
      const response = await authClient.emailOtp.sendVerificationOtp({
        email: normalizedEmail,
        type: "sign-in",
      }, { headers: { ...activityRulesConsentHeaders(rulesAccepted), ...verification.headers } });

      if (response.error) {
        if (response.error.status === 429) setResendCooldownSeconds(PORTAL_EMAIL_OTP_RESEND_COOLDOWN_SECONDS);
        setError(getAuthErrorMessage(response.error, language, t("auth.otp.sendFailed")));
        return;
      }

      setStep("otp");
      setResendCooldownSeconds(PORTAL_EMAIL_OTP_RESEND_COOLDOWN_SECONDS);
      setMessage({ key: isResend ? 'auth.otp.resent' : 'auth.otp.sent', values: { email: normalizedEmail } });
    } catch {
      setError(t("auth.otp.unavailable"));
    } finally {
      verification.reset();
      setIsSending(false);
    }
  }

  async function handleSendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendOtp();
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = normalizePortalEmailOtpInput(otp);

    if (!normalizedEmail || !normalizedOtp) {
      setError(t("auth.otp.fieldsRequired"));
      return;
    }

    if (normalizedOtp.length !== PORTAL_EMAIL_OTP_LENGTH) {
      setError(t("auth.otp.length", { length: PORTAL_EMAIL_OTP_LENGTH }));
      return;
    }

    setIsSigningIn(true);
    setError(null);
    setMessage(null);

    newRegistration.current = false;
    setAllowEntry(false);
    let needsPassword = false;
    try {
      const response = await authClient.signIn.emailOtp({
        email: normalizedEmail,
        otp: normalizedOtp,
      }, {
        headers: activityRulesConsentHeaders(rulesAccepted),
        onSuccess: ({ response }) => {
          newRegistration.current = response.headers.get(NEW_ACCOUNT_RESPONSE_HEADER) === "true";
          needsPassword = response.headers.get(PORTAL_PASSWORD_SETUP_HEADER) === "true";
        },
      });

      if (response.error) {
        newRegistration.current = false;
        setAllowEntry(true);
        setError(getAuthErrorMessage(response.error, language, t("auth.otp.signInFailed")));
        return;
      }

      if (needsPassword) {
        setPassword("");
        setStep("password");
        setMessage(t("auth.email.verified"));
      } else {
        setAllowEntry(true);
        setIsResolvingDestination(true);
        setMessage(t("auth.login.redirecting"));
      }
    } catch {
      newRegistration.current = false;
      setAllowEntry(true);
      setError(t("auth.otp.verifyUnavailable"));
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
    <div className="auth-layout station-entry">
      <div className="auth-intro">
        <div className="station-entry-heading">
          <p className="eyebrow">STARWARD PILGRIMAGE / 2026</p>
          <h2>{returnTo ? t("auth.intro.admin") : t("auth.intro.creator")}</h2>
        </div>
        <div className="station-entry-artwork"><StationTechnicalDrawing variant="entry" /></div>
        <div className="station-entry-caption">
          <Link to="/apply">{t("auth.intro.guide")} <ArrowUpRight size={14} /></Link>
        </div>
      </div>
      <section className="auth-panel" aria-label={returnTo ? t("auth.account.admin") : t("auth.account.creator")}>
        <p className="station-entry-form-label">{returnTo ? 'ORGANIZER ACCESS' : 'CREATOR ACCESS'}</p>
        <h1>{mode === 'reset' ? t("auth.title.reset") : step === "password" ? t("auth.title.setPassword") : mode === 'assisted' ? t("auth.title.assisted") : mode === "register" ? t("auth.title.register") : mode === "otp" ? t("auth.title.otp") : returnTo ? t("auth.title.adminLogin") : t("auth.title.login")}</h1>
        {segment ? <p className="auth-note">{t("auth.segment.notice")}</p> : null}
        <p className="auth-note">{mode === 'reset' ? t("auth.reset.notice") : mode === 'assisted' ? t("auth.assisted.notice") : returnTo ? t("auth.admin.notice") : t("auth.register.notice")}</p>
        <div className="auth-tabs" role="group" aria-label={t("auth.actions.label")}>
          {(
            [
              ["register", t("auth.actions.register")],
              ["login", t("auth.actions.passwordLogin")],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              disabled={isSending || isSigningIn || step === "password"}
              onClick={() => {
                setMode(value);
                setError(null);
                setMessage(null);
                setPassword("");
                setStep("email");
                setOtp("");
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === 'reset' ? <PasswordResetForm
          verification={verification}
          initialEmail={getRealAuthEmail(sessionQuery.data?.user.email) ?? email}
          cooldownSeconds={resendCooldownSeconds}
          onCooldown={() => setResendCooldownSeconds(PORTAL_EMAIL_OTP_RESEND_COOLDOWN_SECONDS)}
          onBusyChange={setIsSigningIn}
          onCancel={() => { setMode('login'); setStep('email'); setError(null); setAllowEntry(false); }}
          onComplete={resetEmail => {
            setAllowEntry(false); setEmail(resetEmail); setPassword(''); setOtp(''); setStep('email'); setMode('login');
            setError(null); setMessage(t("auth.reset.complete"));
            void sessionQuery.refetch();
          }}
        /> : mode === "login" || step === "password" ? (
          <form onSubmit={handlePasswordSubmit}>
            <Field label={t("auth.field.email")}>
              <input
                className="field-input"
                type="email"
                autoComplete="username"
                required
                readOnly={step === "password"}
                disabled={isSigningIn}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Field label={t("auth.field.password")}>
              <input
                className="field-input"
                type="password"
                placeholder={step === "password" ? t("auth.password.placeholderNew") : t("auth.password.placeholder")}
                autoComplete={
                  step === "password" ? "new-password" : "current-password"
                }
                required
                minLength={step === "password" ? 8 : undefined}
                maxLength={128}
                disabled={isSigningIn}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <Button appearance="framed" className="button--accent" type="submit" disabled={isSigningIn} aria-busy={isSigningIn}>
              {isSigningIn
                ? t("auth.actions.submitting")
                : step === "password"
                  ? t("auth.actions.saveEnter")
                  : t("auth.actions.login")}
            </Button>
          </form>
        ) : step === "email" ? (
          <form onSubmit={handleSendOtp}>
            <Field label={t("auth.field.email")}>
              <input
                className="field-input"
                type="email"
                autoComplete="email"
                required
                disabled={isSending || isSigningIn}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <ActivityRulesConsent accepted={rulesAccepted} onChange={setRulesAccepted} disabled={isSending || isSigningIn} otp />
            {verification.node}
            <Button appearance="framed" className="button--accent" type="submit" disabled={isSending || isSigningIn || !verification.ready || resendCooldownSeconds > 0 || (mode === "register" && !rulesAccepted)} aria-busy={isSending}>
              {isSending ? t("auth.actions.sending") : resendCooldownSeconds > 0 ? getPortalEmailOtpResendCooldownText(resendCooldownSeconds, language) : mode === "register" ? t("auth.actions.sendRegistration") : t("auth.actions.sendLogin")}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSignIn}>
            {mode === 'assisted' ? <Field label={t("auth.field.email")}>
              <input className="field-input" type="email" autoComplete="email" required maxLength={320} value={email} disabled={isSigningIn} onChange={event => setEmail(event.target.value)} placeholder={t("auth.assisted.emailPlaceholder")} />
            </Field> : <p className="auth-note">{t("auth.otp.sentNotice", { email })}</p>}
            <Field label={mode === 'assisted' ? t("auth.assisted.code") : t("auth.field.otp")}>
              <input
                className="field-input text-center tracking-[.4em]"
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                placeholder={t("auth.otp.validityPlaceholder", { length: PORTAL_EMAIL_OTP_LENGTH, validity: getPortalEmailOtpValidityLabel(language) })}
                required
                maxLength={PORTAL_EMAIL_OTP_LENGTH}
                pattern="[0-9]*"
                disabled={isSigningIn}
                value={otp}
                onChange={(event) =>
                  setOtp(normalizePortalEmailOtpInput(event.target.value))
                }
              />
            </Field>
            <ActivityRulesConsent accepted={rulesAccepted} onChange={setRulesAccepted} disabled={isSending || isSigningIn} otp />
            <Button appearance="framed" className="button--accent" type="submit" disabled={isSigningIn} aria-busy={isSigningIn}>
              {isSigningIn ? t("auth.actions.verifying") : mode === "register" ? t("auth.actions.verifyEmail") : t("auth.actions.verifyEnter")}
            </Button>
            {mode !== 'assisted' ? <>{verification.node}
            <Button
              appearance="industrial"
              variant="secondary"
              disabled={isSending || isSigningIn || !verification.ready || resendCooldownSeconds > 0}
              aria-busy={isSending}
              onClick={() => void sendOtp(true)}
            >
              {isSending
                ? t("auth.actions.sending")
                : resendCooldownSeconds > 0
                  ? getPortalEmailOtpResendCooldownText(resendCooldownSeconds, language)
                  : t("auth.actions.resend")}
            </Button>
            <button
              type="button"
              className="auth-note"
              onClick={() => {
                verification.reset();
                setStep("email");
                setOtp("");
              }}
            >
              {t("auth.actions.otherEmail")}
            </button></> : null}
          </form>
        )}
        {mode === 'login' && step !== 'password' ? <button type="button" className="auth-otp-toggle" disabled={isSending || isSigningIn} onClick={() => {
          setMode('reset'); setStep('email'); setPassword(''); setError(null); setMessage(null); setAllowEntry(false); setIsResolvingDestination(false);
        }}>{t("auth.actions.forgotPassword")}</button> : null}
        {mode !== "register" && mode !== 'reset' && mode !== 'assisted' && step !== "password" ? (
          <button
            className="auth-otp-toggle"
            type="button"
            disabled={isSending || isSigningIn}
            onClick={() => {
              setMode(mode === "otp" ? "login" : "otp");
              setError(null);
              setMessage(null);
            }}
          >
            {mode === "otp" ? t("auth.actions.passwordReturn") : t("auth.actions.otpLogin")}
          </button>
        ) : null}
        <div className="space-y-3 mt-6">
          {sessionQuery.isPending ? <Notice>{t("auth.session.checking")}</Notice> : null}
          {isResolvingDestination ? (
            <Notice>{t("auth.session.redirecting")}</Notice>
          ) : null}
          {message ? <Notice tone="success">{typeof message === "string" ? label(message) : t(message.key, message.values)}</Notice> : null}
          {error ? <Notice tone="error">{label(error)}</Notice> : null}
        </div>
      </section>
    </div>
  );
}
