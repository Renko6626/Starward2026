import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Field, Notice } from "../../app/components/ui";
import { requestJson } from "../../app/lib/api";
import {
  PORTAL_EMAIL_OTP_LENGTH,
  PORTAL_EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
  getPortalEmailOtpValidityLabel,
  getPortalEmailOtpResendCooldownText,
  getPortalEmailOtpResendSuccessMessage,
  normalizePortalEmailOtpInput,
} from "../../shared/email-otp";
import type { PortalMeResponse } from "../../shared/portal";
import { activityRulesConsentHeaders, NEW_ACCOUNT_RESPONSE_HEADER } from "../../shared/activity-rules";
import { ActivityRulesConsent } from "../components/ActivityRulesConsent";
import { authClient } from "../lib/auth-client";
import { resolvePortalEntryDestination } from "../lib/onboarding";
import { StationTechnicalDrawing } from "../../app/components/StationTechnicalDrawing";
import "./portal-login.css";

export function PortalLoginPage() {
  const { segment } = getRouteApi("/portal_/login").useSearch();
  const navigate = useNavigate();
  const sessionQuery = authClient.useSession();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [mode, setMode] = useState<"login" | "register" | "otp">("register");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isResolvingDestination, setIsResolvingDestination] = useState(false);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
  const newRegistration = useRef(false);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code) setError(code.includes("ACTIVITY_RULES_CHANGED")
      ? "活动规则已更新，请重新确认后登录。"
      : "登录未完成，请使用邮箱登录或注册。");
  }, []);

  useEffect(() => {
    if (!sessionQuery.data) {
      return;
    }

    let cancelled = false;
    setIsResolvingDestination(true);
    const enter = (state: PortalMeResponse | null) => {
      if (cancelled) return;
      const destination = resolvePortalEntryDestination(state, { newRegistration: newRegistration.current, segment });
      if (destination === "/works") {
        void navigate({ to: "/works", search: { view: "gallery", type: "all", q: "" } });
      } else {
        void navigate({ to: "/portal", search: { segment }, hash: segment ? "profile" : undefined });
      }
    };

    void requestJson<PortalMeResponse>("/api/portal/me")
      .then(enter)
      .catch(() => enter(null))
      .finally(() => {
        if (!cancelled) {
          setIsResolvingDestination(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, sessionQuery.data, segment]);

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
    if (mode === "register" && !rulesAccepted) {
      setError("请先阅读并同意活动规则。");
      return;
    }
    setIsSigningIn(true);
    setError(null);
    setMessage(null);
    const normalizedEmail = email.trim().toLowerCase();
    newRegistration.current = mode === "register";

    try {
      const response =
        mode === "register"
          ? await authClient.signUp.email({
              email: normalizedEmail,
              password,
              name: normalizedEmail.split("@")[0] || "参与者",
            }, { headers: activityRulesConsentHeaders(rulesAccepted) })
          : await authClient.signIn.email({ email: normalizedEmail, password });
      if (response.error) {
        newRegistration.current = false;
        setError(
          response.error.message || "注册或登录失败，请检查邮箱和密码。",
        );
        return;
      }
      setPassword("");
      setIsResolvingDestination(true);
    } catch {
      newRegistration.current = false;
      setError("暂时无法连接，请稍后重试。");
    } finally {
      setIsSigningIn(false);
    }
  }

  async function sendOtp(isResend = false) {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("请先输入邮箱。");
      return;
    }

    setIsSending(true);
    setError(null);
    setMessage(null);

    const response = await authClient.emailOtp.sendVerificationOtp({
      email: normalizedEmail,
      type: "sign-in",
    }, { headers: activityRulesConsentHeaders(rulesAccepted) });

    setIsSending(false);

    if (response.error) {
      setError(response.error.message || "验证码发送失败，请稍后重试。");
      return;
    }

    setStep("otp");
    setResendCooldownSeconds(PORTAL_EMAIL_OTP_RESEND_COOLDOWN_SECONDS);
    setMessage(
      isResend
        ? getPortalEmailOtpResendSuccessMessage(normalizedEmail)
        : `验证码已发送到 ${normalizedEmail}。`,
    );
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
    const response = await authClient.signIn.emailOtp({
      email: normalizedEmail,
      otp: normalizedOtp,
    }, {
      headers: activityRulesConsentHeaders(rulesAccepted),
      onSuccess: ({ response }) => {
        newRegistration.current = response.headers.get(NEW_ACCOUNT_RESPONSE_HEADER) === "true";
      },
    });

    setIsSigningIn(false);

    if (response.error) {
      newRegistration.current = false;
      setError(response.error.message || "登录失败，请确认验证码是否正确。");
      return;
    }

    setIsResolvingDestination(true);
    setMessage("验证通过，正在跳转。");
  }

  return (
    <div className="auth-layout station-entry">
      <div className="auth-intro">
        <div className="station-entry-heading">
          <p className="eyebrow">STARWARD PILGRIMAGE / 2026</p>
          <h2>作者页面</h2>
        </div>
        <div className="station-entry-artwork"><StationTechnicalDrawing variant="entry" /></div>
        <div className="station-entry-caption">
          <Link to="/apply">首次参与？阅读参与指南 <ArrowUpRight size={14} /></Link>
        </div>
      </div>
      <section className="auth-panel" aria-label="作者账号">
        <p className="station-entry-form-label">CREATOR ACCESS</p>
        <h1>{mode === "register" ? "注册作者账号" : mode === "otp" ? "邮箱验证码登录" : "登录作者账号"}</h1>
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
              disabled={isSending || isSigningIn}
              onClick={() => {
                setMode(value);
                setError(null);
                setMessage(null);
                setPassword("");
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {mode !== "otp" ? (
          <form onSubmit={handlePasswordSubmit}>
            <Field label="邮箱">
              <input
                className="field-input"
                type="email"
                autoComplete="username"
                required
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
                placeholder={mode === "register" ? "设置 8–128 位密码" : "输入登录密码"}
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                required
                minLength={mode === "register" ? 8 : undefined}
                maxLength={128}
                disabled={isSigningIn}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            {mode === "register" ? <ActivityRulesConsent accepted={rulesAccepted} onChange={setRulesAccepted} disabled={isSigningIn} /> : null}
            <Button type="submit" disabled={isSigningIn || (mode === "register" && !rulesAccepted)}>
              {isSigningIn
                ? "提交中…"
                : mode === "register"
                  ? "注册并进入"
                  : "登录"}
              <ArrowRight size={16} />
            </Button>
          </form>
        ) : step === "email" ? (
          <form onSubmit={handleSendOtp}>
            <Field label="邮箱">
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
            <Button type="submit" disabled={isSending || isSigningIn}>
              {isSending ? "发送中…" : "发送登录验证码"}
              <ArrowRight size={16} />
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
            <Button type="submit" disabled={isSigningIn}>
              {isSigningIn ? "验证中…" : "验证并进入"}
            </Button>
            <Button
              variant="secondary"
              disabled={isSending || isSigningIn || resendCooldownSeconds > 0}
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
                setStep("email");
                setOtp("");
                setResendCooldownSeconds(0);
              }}
            >
              使用其他邮箱
            </button>
          </form>
        )}
        {mode !== "register" ? (
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
