import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, KeyRound, Mail } from "../../app/components/icons";
import { requestJson } from "../../app/lib/api";
import type { PortalMeResponse } from "../../shared/portal";
import {
  PORTAL_EMAIL_OTP_LENGTH,
  PORTAL_EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
  getPortalEmailOtpNoticeText,
  getPortalEmailOtpResendCooldownText,
  getPortalEmailOtpResendSuccessMessage,
  normalizePortalEmailOtpInput,
} from "../../shared/email-otp";
import { authClient } from "../lib/auth-client";
import { resolvePortalEntryDestination } from "../lib/onboarding";

export function PortalLoginPage() {
  const navigate = useNavigate();
  const sessionQuery = authClient.useSession();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [mode, setMode] = useState<"login" | "register" | "otp">("login");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isResolvingDestination, setIsResolvingDestination] = useState(false);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);

  useEffect(() => {
    if (!sessionQuery.data) {
      return;
    }

    let cancelled = false;
    setIsResolvingDestination(true);

    void requestJson<PortalMeResponse>("/api/portal/me")
      .then((response) => {
        if (!cancelled) {
          void navigate({ to: resolvePortalEntryDestination(response) });
        }
      })
      .catch(() => {
        if (!cancelled) {
          void navigate({ to: "/portal" });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsResolvingDestination(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, sessionQuery.data]);

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
      const response = mode === "register"
        ? await authClient.signUp.email({
            email: normalizedEmail,
            password,
            name: normalizedEmail.split("@")[0] || "参与者",
          })
        : await authClient.signIn.email({ email: normalizedEmail, password });
      if (response.error) {
        setError(response.error.message || "注册或登录失败，请检查邮箱和密码。");
        return;
      }
      setPassword("");
      setIsResolvingDestination(true);
    } catch {
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
    });

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
      setError(`请输入 ${PORTAL_EMAIL_OTP_LENGTH} 位访问码。`);
      return;
    }

    setIsSigningIn(true);
    setError(null);
    setMessage(null);

    const response = await authClient.signIn.emailOtp({
      email: normalizedEmail,
      otp: normalizedOtp,
    });

    setIsSigningIn(false);

    if (response.error) {
      setError(response.error.message || "登录失败，请确认验证码是否正确。");
      return;
    }

    setIsResolvingDestination(true);
    setMessage("验证通过，正在进入参与者入口。");
  }

  return (
    <div className="w-full max-w-md mx-auto mt-20 relative z-10">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-headline tracking-tight mb-2">创作者登录</h1>
        <p className="text-on-surface-variant">参与接力企划需要验证您的身份。</p>
      </div>

      <div className="p-8 border border-outline-variant bg-surface-container-low/80 rounded-2xl backdrop-blur-md shadow-2xl">
        <div className="flex gap-4 mb-6" role="group" aria-label="登录方式">
          {([
            ["login", "密码登录"],
            ["register", "注册账号"],
            ["otp", "验证码登录"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              disabled={isSending || isSigningIn}
              className={`text-sm pb-2 border-b-2 ${mode === value ? "border-primary text-primary" : "border-transparent text-on-surface-variant"}`}
              onClick={() => { setMode(value); setError(null); setMessage(null); setPassword(""); }}
            >
              {label}
            </button>
          ))}
        </div>
        {mode !== "otp" ? (
          <form className="space-y-6" onSubmit={handlePasswordSubmit}>
            <label className="block space-y-2 text-sm">
              <span>邮箱</span>
              <input
                className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-3"
                type="email" autoComplete="username" required
                disabled={isSigningIn}
                value={email} onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="block space-y-2 text-sm">
              <span>密码{mode === "register" ? "（8–128 位）" : ""}</span>
              <input
                className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-3"
                type="password" autoComplete={mode === "register" ? "new-password" : "current-password"}
                required minLength={mode === "register" ? 8 : undefined} maxLength={128}
                disabled={isSigningIn}
                value={password} onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button className="w-full bg-primary text-on-primary rounded-xl py-3 disabled:opacity-50" disabled={isSigningIn} type="submit">
              {isSigningIn ? "提交中..." : mode === "register" ? "注册并进入" : "登录"}
            </button>
          </form>
        ) : step === "email" ? (
          <form className="space-y-6" onSubmit={handleSendOtp}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-on-surface-variant block">身份标识 (邮箱)</label>
              <div className="relative">
                <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50" />
                <input
                  autoComplete="email"
                  className="w-full bg-surface-variant border border-outline-variant rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono"
                  disabled={isSending || isSigningIn}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="observer@example.com"
                  type="email"
                  value={email}
                />
              </div>
            </div>
            <button
              className="w-full bg-primary text-on-primary font-medium py-3 rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              disabled={isSending || isSigningIn}
              type="submit"
            >
              {isSending ? "发送中..." : "获取访问码"} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form className="space-y-6" onSubmit={handleSignIn}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-on-surface-variant block">访问码 (OTP)</label>
              <div className="relative">
                <KeyRound className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50" />
                <input
                  autoComplete="one-time-code"
                  className="w-full bg-surface-variant border border-outline-variant rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono tracking-widest text-center text-lg"
                  disabled={isSigningIn}
                  inputMode="numeric"
                  maxLength={PORTAL_EMAIL_OTP_LENGTH}
                  onChange={(event) => setOtp(normalizePortalEmailOtpInput(event.target.value))}
                  pattern="[0-9]*"
                  placeholder={"0".repeat(PORTAL_EMAIL_OTP_LENGTH)}
                  type="text"
                  value={otp}
                />
              </div>
              <p className="text-xs text-on-surface-variant text-center mt-2">{getPortalEmailOtpNoticeText()}</p>
              <p className="text-xs text-on-surface-variant/80 text-center">
                若首封邮件延迟到达，有效期内重新发送仍可继续使用同一验证码。
              </p>
            </div>
            <button
              className="w-full bg-primary text-on-primary font-medium py-3 rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              disabled={isSigningIn}
              type="submit"
            >
              {isSigningIn ? "验证中..." : "验证并进入"}
            </button>
            <button
              className="w-full border border-outline-variant bg-surface-variant py-3 rounded-xl text-sm font-medium text-on-surface transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
              disabled={isSending || isSigningIn || resendCooldownSeconds > 0}
              onClick={() => {
                void sendOtp(true);
              }}
              type="button"
            >
              {isSending
                ? "发送中..."
                : resendCooldownSeconds > 0
                  ? getPortalEmailOtpResendCooldownText(resendCooldownSeconds)
                  : "重新发送验证码"}
            </button>
            <button
              className="w-full text-sm text-on-surface-variant hover:text-primary transition-colors"
              onClick={() => {
                setStep("email");
                setOtp("");
                setResendCooldownSeconds(0);
              }}
              type="button"
            >
              使用其他邮箱
            </button>
          </form>
        )}

        <div className="space-y-3 mt-6">
          {sessionQuery.isPending ? <Notice>正在检查当前登录状态。</Notice> : null}
          {isResolvingDestination ? <Notice>正在为当前账号定位下一步入口。</Notice> : null}
          {message ? <Notice tone="success">{message}</Notice> : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
        </div>
      </div>
    </div>
  );
}

function Notice({ children, tone = "muted" }: { children: string; tone?: "muted" | "success" | "error" }) {
  const toneClass = {
    muted: "border-outline-variant bg-surface-variant/30 text-on-surface-variant",
    success: "border-tertiary/20 bg-tertiary/10 text-tertiary",
    error: "border-error/20 bg-error/10 text-error",
  }[tone];

  return <p className={`rounded-xl border px-4 py-3 text-sm leading-6 ${toneClass}`}>{children}</p>;
}
