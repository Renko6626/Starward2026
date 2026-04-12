import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, KeyRound, Mail } from "../../app/components/icons";
import { requestJson } from "../../app/lib/api";
import type { PortalMeResponse } from "../../shared/portal";
import { authClient } from "../lib/auth-client";
import { resolvePortalEntryDestination } from "../lib/onboarding";

export function PortalLoginPage() {
  const navigate = useNavigate();
  const sessionQuery = authClient.useSession();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isResolvingDestination, setIsResolvingDestination] = useState(false);

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

  async function handleSendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    setMessage(`验证码已发送到 ${normalizedEmail}。`);
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otp.trim();

    if (!normalizedEmail || !normalizedOtp) {
      setError("请输入邮箱和验证码。");
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
    <div className="max-w-md mx-auto mt-20 relative z-10">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-headline tracking-tight mb-2">创作者登录</h1>
        <p className="text-on-surface-variant">参与接力企划需要验证您的身份。</p>
      </div>

      <div className="p-8 border border-outline-variant bg-surface-container-low/80 rounded-2xl backdrop-blur-md shadow-2xl">
        {step === "email" ? (
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
              disabled={isSending}
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
                  onChange={(event) => setOtp(event.target.value)}
                  placeholder="000000"
                  type="text"
                  value={otp}
                />
              </div>
              <p className="text-xs text-on-surface-variant text-center mt-2">访问码已发送至您的邮箱，10分钟内有效。</p>
            </div>
            <button
              className="w-full bg-primary text-on-primary font-medium py-3 rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              disabled={isSigningIn}
              type="submit"
            >
              {isSigningIn ? "验证中..." : "验证并进入"}
            </button>
            <button
              className="w-full text-sm text-on-surface-variant hover:text-primary transition-colors"
              onClick={() => setStep("email")}
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
