import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { motion, useAnimate, useReducedMotion } from "motion/react";
import { Crossfade } from "../../app/components/Crossfade";
import { Button, Field, Notice } from "../../app/components/ui";
import { getTurnstileSiteKey, loadTurnstileApi } from "../../app/lib/turnstile";
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
  const [turnstileEnabled, setTurnstileEnabled] = useState<boolean | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [challengeSize, setChallengeSize] = useState<"flexible" | "compact" | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const otpInput = useRef<HTMLInputElement>(null);
  const reducedMotion = useReducedMotion();
  const tabId = useId();
  const [fieldsScope, animateFields] = useAnimate();
  const challengeContainer = useRef<HTMLDivElement>(null);
  const challengeWidget = useRef<string | undefined>(undefined);
  const siteKey = getTurnstileSiteKey(import.meta.env);
  const challengePending = turnstileEnabled === null || (turnstileEnabled && (!siteKey || !turnstileToken));
  const showChallenge = mode !== "otp" || step === "email" || resendCooldownSeconds === 0;

  const verifyingOtp = mode === "otp" && step === "otp";
  const busy = isSending || isSigningIn || isResolvingDestination;
  const challengeVisible = turnstileEnabled !== false && showChallenge;
  const transition = { duration: reducedMotion ? 0 : .14, ease: "easeOut" as const };

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setChallengeSize(entry.contentRect.width < 300 ? "compact" : "flexible");
    });
    observer.observe(form);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const animation = animateFields(fieldsScope.current, { opacity: [0, 1] }, { duration: reducedMotion ? 0 : .14 });
    return () => animation.stop();
  }, [mode, step, reducedMotion, animateFields, fieldsScope]);

  useEffect(() => {
    if (verifyingOtp) otpInput.current?.focus();
  }, [verifyingOtp]);

  useEffect(() => {
    const controller = new AbortController();
    void requestJson<{ turnstileEnabled: boolean }>("/api/auth/config", { signal: controller.signal })
      .then(config => { if (!controller.signal.aborted) setTurnstileEnabled(config.turnstileEnabled); })
      .catch(() => { if (!controller.signal.aborted) setChallengeError("无法读取登录验证设置，请刷新后重试。"); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!turnstileEnabled || !siteKey || !showChallenge || !challengeSize || !challengeContainer.current) return;
    let cancelled = false;
    setChallengeError(null);
    void loadTurnstileApi().then(api => {
      if (cancelled || !challengeContainer.current) return;
      challengeWidget.current = api.render(challengeContainer.current, {
        sitekey: siteKey,
        theme: "dark",
        size: challengeSize,
        callback: token => { setTurnstileToken(token); setChallengeError(null); },
        "expired-callback": () => {
          setTurnstileToken(null);
          setChallengeError("验证已过期，请重新完成人机验证。");
        },
        "error-callback": () => {
          setTurnstileToken(null);
          setChallengeError("人机验证失败，请刷新后重试。");
        },
      });
    }).catch(() => { if (!cancelled) setChallengeError("人机验证加载失败，请刷新后重试。"); });
    return () => {
      cancelled = true;
      if (challengeWidget.current) window.turnstile?.remove?.(challengeWidget.current);
      challengeWidget.current = undefined;
      setTurnstileToken(null);
    };
  }, [turnstileEnabled, siteKey, showChallenge, challengeSize]);

  function resetChallenge() {
    setTurnstileToken(null);
    setChallengeError(null);
    if (challengeWidget.current) window.turnstile?.reset(challengeWidget.current);
  }
  function authHeaders() {
    return {
      ...activityRulesConsentHeaders(rulesAccepted),
      ...(turnstileEnabled && turnstileToken ? { "x-captcha-response": turnstileToken } : {}),
    };
  }

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
      .catch(() => enter(null));

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
    if (challengePending || busy) return;
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
            }, { headers: authHeaders() })
          : await authClient.signIn.email({ email: normalizedEmail, password }, { headers: authHeaders() });
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
      resetChallenge();
      setIsSigningIn(false);
    }
  }

  async function sendOtp(isResend = false) {
    if (challengePending || busy || (isResend && resendCooldownSeconds > 0)) return;
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("请先输入邮箱。");
      return;
    }

    setIsSending(true);
    setError(null);
    setMessage(null);

    try {
      const response = await authClient.emailOtp.sendVerificationOtp({
        email: normalizedEmail,
        type: "sign-in",
      }, { headers: authHeaders() });
      if (response.error) {
        setError(response.error.message || "验证码发送失败，请稍后重试。");
        return;
      }
      setStep("otp");
      setResendCooldownSeconds(PORTAL_EMAIL_OTP_RESEND_COOLDOWN_SECONDS);
      setMessage(isResend ? getPortalEmailOtpResendSuccessMessage(normalizedEmail) : null);
    } catch {
      setError("暂时无法连接，请稍后重试。");
    } finally {
      setIsSending(false);
      resetChallenge();
    }
  }

  async function handleSendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendOtp();
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
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
    setMessage(null);
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
        <Crossfade valueKey={mode}><h1>{mode === "register" ? "注册作者账号" : mode === "otp" ? "邮箱验证码登录" : "登录作者账号"}</h1></Crossfade>
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
              disabled={busy}
              onClick={() => {
                setMode(value);
                setError(null);
                setMessage(null);
                setPassword("");
              }}
            >
              {label}
              {mode === value ? (
                <motion.span className="auth-tab-indicator" layoutId={tabId} transition={transition} />
              ) : null}
            </button>
          ))}
        </div>
        <form ref={formRef} onSubmit={mode !== "otp" ? handlePasswordSubmit : verifyingOtp ? handleSignIn : handleSendOtp}>
          <div className="auth-fields" ref={fieldsScope}>
            <div hidden={verifyingOtp}>
              <Field label="邮箱">
                <input
                  className="field-input"
                  type="email"
                  autoComplete="username"
                  required={!verifyingOtp}
                  disabled={busy || verifyingOtp}
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </Field>
            </div>
            <div hidden={mode === "otp"}>
              <Field label="密码">
                <input
                  className="field-input"
                  type="password"
                  placeholder={mode === "register" ? "设置 8–128 位密码" : "输入登录密码"}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  required={mode !== "otp"}
                  minLength={mode === "register" ? 8 : undefined}
                  maxLength={128}
                  disabled={busy || mode === "otp"}
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                />
              </Field>
            </div>
            {verifyingOtp ? (
              <div className="auth-otp-fields">
                <p className="auth-note">验证码已发送至 {email}</p>
                <Field label="邮箱验证码">
                  <input
                    ref={otpInput}
                    className="field-input auth-otp-input"
                    type="text"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    placeholder={`输入 ${PORTAL_EMAIL_OTP_LENGTH} 位验证码`}
                    aria-label="邮箱验证码"
                    aria-describedby="auth-otp-validity"
                    required
                    maxLength={PORTAL_EMAIL_OTP_LENGTH}
                    pattern="[0-9]*"
                    disabled={busy}
                    value={otp}
                    onChange={event => setOtp(normalizePortalEmailOtpInput(event.target.value))}
                  />
                  <span id="auth-otp-validity" className="field-hint">{getPortalEmailOtpValidityLabel()}内有效</span>
                </Field>
              </div>
            ) : null}
            {mode !== "login" ? <ActivityRulesConsent accepted={rulesAccepted} onChange={setRulesAccepted} disabled={busy} otp={mode === "otp"} /> : null}
          </div>
          {verifyingOtp ? (
            <div className="auth-primary-action">
              {error ? <Notice tone="error">{error}</Notice> : null}
              <Button appearance="framed" className="button--accent" type="submit" disabled={busy} aria-busy={isSigningIn || isResolvingDestination}>
                {isResolvingDestination ? "正在进入…" : isSigningIn ? "验证中…" : "验证并进入"}
              </Button>
            </div>
          ) : null}
          <motion.div
            className="auth-challenge"
            initial={false}
            animate={{ height: challengeVisible ? "auto" : 0, opacity: challengeVisible ? 1 : 0 }}
            transition={transition}
            aria-hidden={!challengeVisible}
            inert={!challengeVisible}
          >
            <div className="auth-challenge-content" role="group" aria-labelledby="auth-challenge-label">
              <span id="auth-challenge-label" className="field-label">{verifyingOtp ? "重新发送验证码的人机验证" : "人机验证"}</span>
              <div ref={challengeContainer} className={`auth-challenge-widget${challengeSize === "compact" ? " is-compact" : ""}`} />
              <p className={`auth-challenge-status${challengeError ? " is-error" : ""}`} aria-live="polite">
                {challengeError || (turnstileEnabled && !siteKey ? "验证设置暂不可用，请联系主催。" : turnstileToken ? "验证通过" : "正在等待人机验证…")}
              </p>
            </div>
          </motion.div>
          {!verifyingOtp ? (
            <div className="auth-primary-action">
              {error ? <Notice tone="error">{error}</Notice> : null}
              <Button appearance="framed" className="button--accent" type="submit"
                disabled={busy || challengePending || (mode === "register" && !rulesAccepted)}
                aria-busy={busy}>
                {isResolvingDestination ? "正在进入…" : isSending ? "发送中…" : isSigningIn ? "提交中…" : mode === "register" ? "注册并进入" : mode === "otp" ? "发送登录验证码" : "登录"}
              </Button>
            </div>
          ) : (
            <div className="auth-resend-actions">
              {message ? <Notice tone="success">{message}</Notice> : null}
              <Button appearance="industrial" variant="secondary"
                disabled={busy || resendCooldownSeconds > 0 || challengePending}
                aria-busy={isSending}
                onClick={() => void sendOtp(true)}>
                {isSending ? "发送中…" : resendCooldownSeconds > 0 ? getPortalEmailOtpResendCooldownText(resendCooldownSeconds) : "重新发送验证码"}
              </Button>
              <button type="button" className="auth-note" disabled={busy} onClick={() => {
                setStep("email");
                setOtp("");
                setResendCooldownSeconds(0);
                setError(null);
                setMessage(null);
              }}>使用其他邮箱</button>
            </div>
          )}
        </form>
        {mode !== "register" ? (
          <button
            className="auth-otp-toggle"
            type="button"
            disabled={busy}
            onClick={() => {
              setMode(mode === "otp" ? "login" : "otp");
              setError(null);
              setMessage(null);
            }}
          >
            {mode === "otp" ? "返回密码登录" : "使用邮箱验证码登录"}
          </button>
        ) : null}
        {sessionQuery.isPending ? <Notice>正在检查登录状态。</Notice> : null}
      </section>
    </div>
  );
}
