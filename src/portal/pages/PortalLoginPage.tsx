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
  getPortalEmailOtpResendSuccessMessage,
  normalizePortalEmailOtpInput,
} from "../../shared/email-otp";
import type { PortalMeResponse } from "../../shared/portal";
import { getRealAuthEmail } from "../../shared/auth-identity";
import { activityRulesConsentHeaders, NEW_ACCOUNT_RESPONSE_HEADER } from "../../shared/activity-rules";
import { ActivityRulesConsent } from "../components/ActivityRulesConsent";
import { authClient } from "../lib/auth-client";
import { getPasswordAuthErrorMessage } from "../lib/password-auth-error";
import { resolvePortalEntryDestination } from "../lib/onboarding";
import { StationTechnicalDrawing } from "../../app/components/StationTechnicalDrawing";
import { PasswordResetForm } from "../components/PasswordResetForm";
import { useTurnstileVerification } from '../../app/components/use-turnstile';
import { getTurnstileErrorMessage, type PublicAuthProvidersResponse } from '../../shared/turnstile';
import "./portal-login.css";

export function PortalLoginPage() {
  const { segment, reset, returnTo } = getRouteApi("/portal_/login").useSearch();
  const navigate = useNavigate();
  const sessionQuery = authClient.useSession();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [mode, setMode] = useState<"login" | "register" | "otp" | "reset">(reset === 'password' ? 'reset' : returnTo ? 'login' : 'register');
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "otp" | "password">("email");
  const [allowEntry, setAllowEntry] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isResolvingDestination, setIsResolvingDestination] = useState(false);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
  const newRegistration = useRef(false);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [turnstileRequired, setTurnstileRequired] = useState<boolean>();
  const verification = useTurnstileVerification(turnstileRequired, step !== 'password', `${mode}:${step}`);
  useEffect(() => {
    let cancelled = false;
    void requestJson<PublicAuthProvidersResponse>('/api/auth/providers')
      .then(config => { if (!cancelled) setTurnstileRequired(config.turnstile.enabled); })
      .catch(() => { if (!cancelled) setError('无法读取验证设置，请刷新页面后重试。'); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code) setError(code.includes("ACTIVITY_RULES_CHANGED")
      ? "活动规则已更新，请重新确认后登录。"
      : "登录未完成，请使用邮箱登录或注册。");
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
        if (accounts.error) throw new Error('无法读取密码设置，请刷新后重试。');
        if (!accounts.data.some(account => account.providerId === 'credential')) {
          setEmail(user.email);
          setStep('password');
          setAllowEntry(false);
          setIsResolvingDestination(false);
          setMessage('邮箱已验证，请设置登录密码。');
          return;
        }
      }
      const state = await requestJson<PortalMeResponse>('/api/portal/me').catch(() => null);
      enter(state);
    })()
      .catch(caught => { if (!cancelled) setError(caught instanceof Error ? caught.message : '无法读取账号，请刷新后重试。'); })
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
    if (step !== 'password' && !verification.ready) { setError('请先完成人机验证。'); return; }
    setIsSigningIn(true);
    setError(null);
    setMessage(null);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      if (step === "password") {
        const response = await authClient.$fetch('/set-password', { method: 'POST', body: { newPassword: password } });
        if (response.error && (!('code' in response.error) || response.error.code !== 'PASSWORD_ALREADY_SET')) { setError(response.error.message || '密码设置失败，请重试。'); return; }
      } else {
        newRegistration.current = false;
        const response = await authClient.signIn.email({ email: normalizedEmail, password }, { headers: verification.headers });
        if (response.error) {
          setError(getPasswordAuthErrorMessage(response.error));
          return;
        }
      }
      setPassword("");
      setAllowEntry(true);
      setIsResolvingDestination(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "暂时无法连接，请稍后重试。");
    } finally {
      if (step !== 'password') verification.reset();
      setIsSigningIn(false);
    }
  }

  async function sendOtp(isResend = false) {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("请先输入邮箱。");
      return;
    }
    if (mode === "register" && !rulesAccepted) {
      setError("请先阅读并同意活动规则。");
      return;
    }
    if (!verification.ready) { setError('请先完成人机验证。'); return; }

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
        setError(getTurnstileErrorMessage(response.error) || response.error.message || "验证码发送失败，请稍后重试。");
        return;
      }

      setStep("otp");
      setResendCooldownSeconds(PORTAL_EMAIL_OTP_RESEND_COOLDOWN_SECONDS);
      setMessage(
        isResend
          ? getPortalEmailOtpResendSuccessMessage(normalizedEmail)
          : `验证码已发送到 ${normalizedEmail}。`,
      );
    } catch {
      setError("暂时无法发送验证码，请稍后重试。");
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
      setError("请输入邮箱和验证码。");
      return;
    }

    if (normalizedOtp.length !== PORTAL_EMAIL_OTP_LENGTH) {
      setError(`请输入 ${PORTAL_EMAIL_OTP_LENGTH} 位验证码。`);
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
        setError(response.error.message || "登录失败，请确认验证码是否正确。");
        return;
      }

      if (needsPassword) {
        setPassword("");
        setStep("password");
        setMessage("邮箱已验证，请设置登录密码。");
      } else {
        setAllowEntry(true);
        setIsResolvingDestination(true);
        setMessage("验证通过，正在跳转。");
      }
    } catch {
      newRegistration.current = false;
      setAllowEntry(true);
      setError("暂时无法验证，请稍后重试。");
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
    <div className="auth-layout station-entry">
      <div className="auth-intro">
        <div className="station-entry-heading">
          <p className="eyebrow">STARWARD PILGRIMAGE / 2026</p>
          <h2>{returnTo ? '活动管理' : '作者页面'}</h2>
        </div>
        <div className="station-entry-artwork"><StationTechnicalDrawing variant="entry" /></div>
        <div className="station-entry-caption">
          <Link to="/apply">首次参与？阅读参与指南 <ArrowUpRight size={14} /></Link>
        </div>
      </div>
      <section className="auth-panel" aria-label={returnTo ? '管理员账号' : '作者账号'}>
        <p className="station-entry-form-label">{returnTo ? 'ORGANIZER ACCESS' : 'CREATOR ACCESS'}</p>
        <h1>{mode === 'reset' ? '重置登录密码' : step === "password" ? "设置登录密码" : mode === "register" ? "注册作者账号" : mode === "otp" ? "邮箱验证码登录" : returnTo ? '登录管理账号' : "登录作者账号"}</h1>
        <p className="auth-note">{mode === 'reset' ? '验证码会发送到登录邮箱。重置成功后，请用新密码重新登录。' : returnTo ? '使用已获授权的网站账号登录。新注册账号需由初始管理员授予管理权限。' : '注册时先用验证码验证邮箱，再设置密码。报名联系方式可另行填写。'}</p>
        <div className="auth-tabs" role="group" aria-label="账号操作">
          {(
            [
              ["register", "注册账号"],
              ["login", "密码登录"],
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
            setError(null); setMessage('密码已重置，旧会话已退出。请用新密码登录。');
            void sessionQuery.refetch();
          }}
        /> : mode === "login" || step === "password" ? (
          <form onSubmit={handlePasswordSubmit}>
            <Field label="登录邮箱">
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
            <Field label="密码">
              <input
                className="field-input"
                type="password"
                placeholder={step === "password" ? "设置 8–128 位密码" : "输入登录密码"}
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
            {step !== 'password' ? verification.node : null}
            <Button appearance="framed" className="button--accent" type="submit" disabled={isSigningIn || (step !== 'password' && !verification.ready)} aria-busy={isSigningIn}>
              {isSigningIn
                ? "提交中…"
                : step === "password"
                  ? "保存密码并进入"
                  : "登录"}
            </Button>
          </form>
        ) : step === "email" ? (
          <form onSubmit={handleSendOtp}>
            <Field label="登录邮箱">
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
              {isSending ? "发送中…" : resendCooldownSeconds > 0 ? getPortalEmailOtpResendCooldownText(resendCooldownSeconds) : mode === "register" ? "发送注册验证码" : "发送登录验证码"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSignIn}>
            <p className="auth-note">验证码已发送至 {email}</p>
            <Field label="邮箱验证码">
              <input
                className="field-input text-center tracking-[.4em]"
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                placeholder={`${PORTAL_EMAIL_OTP_LENGTH} 位验证码，${getPortalEmailOtpValidityLabel()}内有效`}
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
              {isSigningIn ? "验证中…" : mode === "register" ? "验证邮箱" : "验证并进入"}
            </Button>
            {verification.node}
            <Button
              appearance="industrial"
              variant="secondary"
              disabled={isSending || isSigningIn || !verification.ready || resendCooldownSeconds > 0}
              aria-busy={isSending}
              onClick={() => void sendOtp(true)}
            >
              {isSending
                ? "发送中…"
                : resendCooldownSeconds > 0
                  ? getPortalEmailOtpResendCooldownText(resendCooldownSeconds)
                  : "重新发送验证码"}
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
              使用其他邮箱
            </button>
          </form>
        )}
        {mode === 'login' && step !== 'password' ? <button type="button" className="auth-otp-toggle" disabled={isSending || isSigningIn} onClick={() => {
          setMode('reset'); setStep('email'); setPassword(''); setError(null); setMessage(null); setAllowEntry(false); setIsResolvingDestination(false);
        }}>忘记密码？通过邮箱重置</button> : null}
        {mode !== "register" && mode !== 'reset' && step !== "password" ? (
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
            {mode === "otp" ? "返回密码登录" : "使用邮箱验证码登录"}
          </button>
        ) : null}
        <div className="space-y-3 mt-6">
          {sessionQuery.isPending ? <Notice>正在检查登录状态。</Notice> : null}
          {isResolvingDestination ? (
            <Notice>正在跳转，请稍候。</Notice>
          ) : null}
          {message ? <Notice tone="success">{message}</Notice> : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
        </div>
      </section>
    </div>
  );
}
