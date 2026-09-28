import { useEffect, useState, type FormEvent } from "react";
import { requestJson } from "../../app/lib/api";
import { authClient } from "../lib/auth-client";

export function PasswordSettings() {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void authClient.listAccounts().then((response) => {
      if (cancelled) return;
      if (response.error) {
        setError("无法读取密码设置，请刷新后重试。");
        return;
      }
      setHasPassword(response.data.some((account) => account.providerId === "credential"));
    }).catch(() => {
      if (!cancelled) setError("无法读取密码设置，请刷新后重试。");
    });
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (hasPassword) {
        const response = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
        if (response.error) {
          setError(response.error.message || "密码修改失败。");
          return;
        }
      } else {
        await requestJson("/api/auth/set-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ newPassword }),
        });
      }
      setHasPassword(true);
      setCurrentPassword("");
      setNewPassword("");
      setMessage("密码已保存，下次可使用邮箱和密码登录。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "密码保存失败。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="space-y-4 bg-surface-container-low/50 border border-outline-variant rounded-xl p-6" onSubmit={handleSubmit}>
      <h2 className="text-lg font-medium">登录密码</h2>
      {hasPassword === false ? <p className="text-sm text-on-surface-variant">为当前账号设置密码，之后可直接使用密码登录。</p> : null}
      {hasPassword !== null ? (
        <>
          {hasPassword ? (
            <label className="block space-y-2 text-sm">
              <span>当前密码</span>
              <input className="w-full bg-surface-variant border border-outline-variant rounded-md px-4 py-2" type="password" autoComplete="current-password" required disabled={isSaving} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            </label>
          ) : null}
          <label className="block space-y-2 text-sm">
            <span>新密码（8–128 位）</span>
            <input className="w-full bg-surface-variant border border-outline-variant rounded-md px-4 py-2" type="password" autoComplete="new-password" required minLength={8} maxLength={128} disabled={isSaving} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </label>
          <button className="bg-primary text-on-primary rounded-md px-4 py-2 disabled:opacity-50" type="submit" disabled={isSaving}>
            {isSaving ? "保存中..." : hasPassword ? "修改密码" : "设置密码"}
          </button>
        </>
      ) : null}
      {message ? <p className="text-sm text-tertiary" role="status">{message}</p> : null}
      {error ? <p className="text-sm text-error" role="alert">{error}</p> : null}
    </form>
  );
}
