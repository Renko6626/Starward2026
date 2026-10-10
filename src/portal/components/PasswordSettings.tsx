import { useEffect, useState, type FormEvent } from "react";
import { requestJson } from "../../app/lib/api";
import { authClient } from "../lib/auth-client";
import { Button, Field, Notice } from "../../app/components/ui";

export function PasswordSettings() {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void authClient
      .listAccounts()
      .then((response) => {
        if (cancelled) return;
        if (response.error) {
          setError("无法读取密码设置，请刷新后重试。");
          return;
        }
        setHasPassword(
          response.data.some((account) => account.providerId === "credential"),
        );
      })
      .catch(() => {
        if (!cancelled) setError("无法读取密码设置，请刷新后重试。");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (hasPassword) {
        const response = await authClient.changePassword({
          currentPassword,
          newPassword,
          revokeOtherSessions: true,
        });
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
    <form className="panel space-y-5" onSubmit={handleSubmit}>
      <h2 className="panel-title">登录密码</h2>
      {hasPassword !== null ? (
        <>
          {hasPassword ? (
            <Field label="当前密码">
              <input
                className="field-input"
                type="password"
                autoComplete="current-password"
                placeholder="输入当前登录密码"
                required
                disabled={isSaving}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </Field>
          ) : null}
          <Field label="新密码">
            <input
              className="field-input"
              type="password"
              autoComplete="new-password"
              placeholder="设置 8–128 位密码"
              required
              minLength={8}
              maxLength={128}
              disabled={isSaving}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </Field>
          <Button
            type="submit"
            disabled={isSaving}
          >
            {isSaving ? "保存中..." : hasPassword ? "修改密码" : "设置密码"}
          </Button>
        </>
      ) : null}
      {message ? (
        <Notice tone="success">
          {message}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="error">
          {error}
        </Notice>
      ) : null}
    </form>
  );
}
