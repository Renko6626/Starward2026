import { useSiteTranslation } from "../../i18n/use-site-translation";
import { ArchiveChapter, revealArchiveTarget } from "../components/ArchiveChapter";
import { ArchiveResult } from "../components/ArchiveResult";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Field, PageHeading, ReadError } from "../../app/components/ui";
import { ApiError, requestJson } from "../../app/lib/api";
import type {
  PortalProfileMutationResponse,
  PortalProfileResponse,
  UpdatePortalProfileInput,
} from "../../shared/portal";
import { updatePortalProfileInputSchema } from "../../shared/portal";
import { LoginPasswordDialog } from "../components/LoginPasswordDialog";
import { authClient } from "../lib/auth-client";
import { getBilibiliProfileUrl, normalizePortalProfileInput, portalContactChannels, portalProfilePlaceholders } from "../lib/profile-form";
import { getRegistrationFieldErrors } from "../lib/registration-validation";

const defaultFormState: UpdatePortalProfileInput = {
  creditName: "",
  bilibiliUid: "",
  contactEmail: "",
  primaryContactChannel: "QQ",
  primaryContactHandle: "",
  backupContact: "",
  isAnonymous: true,
};

export function PortalProfilePage({ embedded = false, compact = false, onSaved }: { embedded?: boolean; compact?: boolean; onSaved?: () => Promise<void> } = {}) {
  const { t, language, label: systemLabel } = useSiteTranslation();
  const navigate = useNavigate();
  const sessionQuery = authClient.useSession();
  const initialized = useRef(false);
  const [form, setForm] = useState<UpdatePortalProfileInput>(defaultFormState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const [profileState, setProfileState] = useState<PortalProfileResponse | null>(null);

  useEffect(() => {
    if (!sessionQuery.isPending && !sessionQuery.data) {
      void navigate({ to: "/portal/login" });
      return;
    }

    if (!sessionQuery.data) {
      return;
    }

    let cancelled = false;
    if (!initialized.current) setIsLoading(true);
    setError(null);

    void requestJson<PortalProfileResponse>("/api/portal/profile")
      .then((response) => {
        if (!cancelled) {
          if (!initialized.current) {
            setForm(buildInitialProfileForm(response));
            initialized.current = true;
          }
          setProfileState(response);
          setIsLoading(false);
        }
      })
      .catch((caught) => {
        if (cancelled) {
          return;
        }

        if (caught instanceof ApiError && caught.status === 401) {
          void navigate({ to: "/portal/login" });
          return;
        }

        setError(
          caught instanceof Error ? caught.message : t("portal.profile.loadError"),
        );
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, sessionQuery.data, sessionQuery.isPending, language]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setRefreshWarning(null);
    setError(null);

    setFieldErrors({});

    const normalized = normalizePortalProfileInput(form, profileState?.user.email);
    const parsed = updatePortalProfileInputSchema.safeParse(normalized);

    if (!parsed.success) {
      setFieldErrors(getRegistrationFieldErrors(parsed.error.issues, "profile", language));
      setError(t("portal.validation.correctFields"));
      requestAnimationFrame(() => {
        const input = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
        if (input) revealArchiveTarget(input);
        input?.scrollIntoView({ block: "center" });
        input?.focus({ preventScroll: true });
      });
      return;
    }

    setIsSaving(true);

    try {
      const response = await requestJson<PortalProfileMutationResponse>(
        "/api/portal/profile",
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(parsed.data),
        },
      );

      setForm(buildInitialProfileFormFromMutation(parsed.data));
      if (!embedded && profileState && !profileState.profile && !profileState.application) {
        await navigate({ to: "/portal/application" });
        return;
      }
      setProfileState((current) =>
        current ? { ...current, profile: response.profile } : current,
      );
      setMessage(response.message);
      await onSaved?.().catch(() => setRefreshWarning(t("portal.profile.savedRefresh")));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("portal.profile.saveError"));
    } finally {
      setIsSaving(false);
    }
  }

  if (sessionQuery.isPending || isLoading) {
    return (
      <PageHeading
        title={<>{t("portal.profile.title")}</>}
        description={<>{t("portal.profile.loading")}</>}
      ></PageHeading>
    );
  }

  if (!profileState) {
    return (
      <div className={embedded ? "space-y-6" : "page-content"}>
        <PageHeading title={t("portal.profile.title")} />
        <ReadError message={systemLabel(error || t("portal.profile.unavailable"))} />
      </div>
    );
  }

  const continueToApplication = !embedded && !profileState.profile && !profileState.application;

  const profileField = (key: "creditName" | "bilibiliUid" | "primaryContactChannel" | "primaryContactHandle" | "backupContact", label: string, type = "text") => <Field label={label} error={fieldErrors[`profile.${key}`]}><input name={`profile.${key}`} className="field-input" type={type} required={key !== "backupContact"} maxLength={key === "bilibiliUid" ? 512 : undefined} placeholder={systemLabel(portalProfilePlaceholders[key])} value={form[key] ?? ""} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} />{key === "bilibiliUid" && getBilibiliProfileUrl(form.bilibiliUid) ? <a className="text-link" href={getBilibiliProfileUrl(form.bilibiliUid)} target="_blank" rel="noreferrer">{t("portal.profile.visitBilibili")}</a> : null}</Field>;
  return <ArchiveChapter enabled={compact} id="profile" number="01" title={t("portal.profile.title")} state={profileState.profile?.creditName} defaultOpen={!profileState.profile}>
    <div className={embedded ? "space-y-6" : "page-content"}>
    {!embedded ? <PageHeading title={t("portal.profile.title")} /> : null}
    <div className={compact ? "creator-card-body" : undefined}>
      <form ref={formRef} noValidate className={compact ? "space-y-4" : "panel space-y-6"} onSubmit={handleSubmit} onChangeCapture={event => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
        setMessage(null);
        if (fieldErrors[target.name]) {
          setFieldErrors(current => { const next = { ...current }; delete next[target.name]; return next; });
          setError(null);
        }
      }}>
        {profileField("creditName", t("portal.profile.creditName"))}
        <label className="checkbox-field"><input type="checkbox" checked={form.isAnonymous} onChange={event => setForm(current => ({ ...current, isAnonymous: event.target.checked }))} />{t("portal.profile.anonymous")}<span className="field-hint">{t("portal.profile.anonymousHint")}</span></label>
        {profileField("bilibiliUid", t("portal.profile.bilibili"))}
        <Field label={t("portal.profile.contactType")} error={fieldErrors["profile.primaryContactChannel"]}><select name="profile.primaryContactChannel" className="field-input" value={form.primaryContactChannel} onChange={event => setForm(current => ({ ...current, primaryContactChannel: event.target.value }))}>{!portalContactChannels.includes(form.primaryContactChannel) ? <option value={form.primaryContactChannel}>{form.primaryContactChannel}</option> : null}{portalContactChannels.map(channel => <option key={channel} value={channel}>{channel === "Email" ? t("portal.profile.email") : systemLabel(channel)}</option>)}</select></Field>
        {profileField("primaryContactHandle", t("portal.profile.contactValue"))}
        {profileField("backupContact", t("portal.profile.backupOptional"))}
        <p className="field-hint">{t("portal.profile.contactHint")}</p>
        {refreshWarning ? <ArchiveResult compact={compact} tone="warning" message={refreshWarning} /> : null}
        {message ? <ArchiveResult compact={compact} message={message} /> : null}
        {error ? <ArchiveResult compact={compact} tone="error" message={error} /> : null}
        <div className="form-actions">
          {!embedded ? <Link className="button button--secondary" to="/portal">{t("portal.workspace.return")}</Link> : null}
          <Button appearance={compact ? "industrial" : "default"} disabled={isSaving} aria-busy={isSaving} type="submit">{isSaving ? t("portal.common.saving") : continueToApplication ? t("portal.profile.saveContinue") : t("portal.profile.save")}</Button>
        </div>
      </form>
      <LoginPasswordDialog email={profileState.user.email} />
    </div>
  </div></ArchiveChapter>;
}

function buildInitialProfileForm(
  response: PortalProfileResponse,
): UpdatePortalProfileInput {
  if (response.profile) {
    return {
      creditName: response.profile.creditName ?? "",
      bilibiliUid: response.profile.bilibiliUid ?? "",
      contactEmail: response.profile.contactEmail,
      primaryContactChannel: response.profile.primaryContactChannel,
      primaryContactHandle: response.profile.primaryContactHandle,
      backupContact: response.profile.backupContact ?? "",
      isAnonymous: response.profile.isAnonymous,
    };
  }

  return {
    creditName: "",
    bilibiliUid: "",
    contactEmail: null,
    primaryContactChannel: "QQ",
    primaryContactHandle: "",
    backupContact: "",
    isAnonymous: true,
  };
}

function buildInitialProfileFormFromMutation(
  input: UpdatePortalProfileInput,
): UpdatePortalProfileInput {
  return {
    ...input,
    backupContact: input.backupContact ?? "",
    creditName: input.creditName ?? "",
  };
}
