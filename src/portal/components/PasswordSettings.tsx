import { getAuthErrorMessage } from "../lib/password-auth-error";
import { useSiteTranslation } from "../../i18n/use-site-translation";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from '@tanstack/react-router';
import { requestJson } from "../../app/lib/api";
import { authClient } from "../lib/auth-client";
import { Button, Field, Notice } from "../../app/components/ui";

export function PasswordSettings() {
  const { t, language, label } = useSiteTranslation();
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
          setError(t("auth.password.readFailed"));
          return;
        }
        setHasPassword(
          response.data.some((account) => account.providerId === "credential"),
        );
      })
      .catch(() => {
        if (!cancelled) setError(t("auth.password.readFailed"));
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
          setError(getAuthErrorMessage(response.error, language, t("auth.password.changeFailed")));
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
      setMessage(t("auth.password.saved"));
    } catch (caught) {
      setError(caught instanceof Error ? label(caught.message) : t("auth.password.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="panel space-y-5" onSubmit={handleSubmit}>
      <h2 className="panel-title">{t("auth.password.title")}</h2>
      {hasPassword !== null ? (
        <>
          {hasPassword ? (
            <Field label={t("auth.password.current")}>
              <input
                className="field-input"
                type="password"
                autoComplete="current-password"
                placeholder={t("auth.password.placeholderCurrent")}
                required
                disabled={isSaving}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </Field>
          ) : null}
          <Field label={t("auth.password.new")}>
            <input
              className="field-input"
              type="password"
              autoComplete="new-password"
              placeholder={t("auth.password.placeholderNew")}
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
            aria-busy={isSaving}
          >
            {isSaving ? t("auth.actions.saving") : hasPassword ? t("auth.actions.changePassword") : t("auth.actions.setPassword")}
          </Button>
        </>
      ) : null}
      {message ? (
        <Notice tone="success">
          {label(message)}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="error">
          {label(error)}
        </Notice>
      ) : null}
      {hasPassword ? <Link className="auth-note" to="/portal/login" search={{ reset: 'password' }}>{t("auth.actions.forgotCurrent")}</Link> : null}
    </form>
  );
}
