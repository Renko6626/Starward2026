import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SectionCard } from "../../app/components/SectionCard";
import { StatusBadge } from "../../app/components/StatusBadge";
import { authClient } from "../lib/auth-client";

export function PortalLoginPage() {
  const navigate = useNavigate();
  const sessionQuery = authClient.useSession();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [phase, setPhase] = useState<"idle" | "otp-sent" | "verifying">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (sessionQuery.data) {
      void navigate({ to: "/portal" });
    }
  }, [navigate, sessionQuery.data]);

  async function handleSendOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("请先输入受邀邮箱。");
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

    setPhase("otp-sent");
    setMessage(`验证码已发送到 ${normalizedEmail}。`);
  }

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otp.trim();

    if (!normalizedEmail || !normalizedOtp) {
      setError("请输入邮箱和验证码。");
      return;
    }

    setIsSigningIn(true);
    setPhase("verifying");
    setError(null);
    setMessage(null);

    const response = await authClient.signIn.emailOtp({
      email: normalizedEmail,
      otp: normalizedOtp,
    });

    setIsSigningIn(false);

    if (response.error) {
      setPhase("otp-sent");
      setError(response.error.message || "登录失败，请确认验证码是否正确。");
      return;
    }

    void navigate({ to: "/portal" });
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <StatusBadge label="受控入口" tone="info" />
        <h1>参与者登录</h1>
        <p>第一期采用 Better Auth + Email OTP，不开放自由注册，只允许已审核参与者进入。</p>
      </div>

      <SectionCard
        eyebrow="一期认证策略"
        title="为什么不是注册账号"
        description="这个活动规模只有三四十人，更适合受控邮箱登录，而不是做一个大型账号系统。"
      >
        <ul className="plain-list">
          <li>已审核邮箱才能成为有效门户入口。</li>
          <li>用户不需要记密码。</li>
          <li>主催可以直接按邮箱识别参与者。</li>
          <li>当前已接入 Better Auth Email OTP + Resend 邮件发送。</li>
        </ul>
      </SectionCard>

      <SectionCard
        eyebrow="登录流程"
        title="输入受邀邮箱，收验证码后完成登录"
        description="未通过审核或已撤回资格的邮箱不会成为有效门户入口。"
        accent="blue"
      >
        <div className="grid-two portal-auth-grid">
          <form className="form-grid" onSubmit={handleSendOtp}>
            <label className="field">
              <span>受邀邮箱</span>
              <input
                autoComplete="email"
                disabled={isSending || isSigningIn}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                type="email"
                value={email}
              />
            </label>

            <div className="action-row">
              <button className="button button--primary" disabled={isSending || isSigningIn} type="submit">
                {isSending ? "发送中" : "发送验证码"}
              </button>
            </div>
          </form>

          <form className="form-grid" onSubmit={handleSignIn}>
            <label className="field">
              <span>验证码</span>
              <input
                autoComplete="one-time-code"
                disabled={isSending || isSigningIn || phase === "idle"}
                inputMode="numeric"
                onChange={(event) => setOtp(event.target.value)}
                placeholder="6 位验证码"
                value={otp}
              />
            </label>

            <div className="action-row">
              <button
                className="button button--primary"
                disabled={isSending || isSigningIn || phase === "idle"}
                type="submit"
              >
                {isSigningIn ? "登录中" : "确认登录"}
              </button>
            </div>
          </form>
        </div>

        {sessionQuery.isPending ? <p className="inline-message">正在检查当前登录状态。</p> : null}
        {message ? <p className="inline-message inline-message--success">{message}</p> : null}
        {error ? <p className="inline-message inline-message--error">{error}</p> : null}
        {phase === "verifying" ? <p className="inline-message">正在建立参与者会话。</p> : null}
      </SectionCard>
    </div>
  );
}
