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
          caught instanceof Error ? caught.message : "无法读取署名和联系方式。",
        );
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, sessionQuery.data, sessionQuery.isPending]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setRefreshWarning(null);
    setError(null);

    setFieldErrors({});

    const normalized = normalizePortalProfileInput(form, profileState?.user.email);
    const parsed = updatePortalProfileInputSchema.safeParse(normalized);

    if (!parsed.success) {
      setFieldErrors(getRegistrationFieldErrors(parsed.error.issues, "profile"));
      setError("请修正标出的字段后重试。");
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
      await onSaved?.().catch(() => setRefreshWarning("资料已保存，页面暂未更新，请稍后刷新。"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "资料保存失败。");
    } finally {
      setIsSaving(false);
    }
  }

  if (sessionQuery.isPending || isLoading) {
    return (
      <PageHeading
        title={<>署名与联系</>}
        description={<>正在读取署名和联系方式。</>}
      ></PageHeading>
    );
  }

  if (!profileState) {
    return (
      <div className={embedded ? "space-y-6" : "page-content"}>
        <PageHeading title="署名与联系" />
        <ReadError message={error || "暂时无法读取署名与联系。"} />
      </div>
    );
  }

  const continueToApplication = !embedded && !profileState.profile && !profileState.application;

  const profileField = (key: "creditName" | "bilibiliUid" | "primaryContactChannel" | "primaryContactHandle" | "backupContact", label: string, type = "text") => <Field label={label} error={fieldErrors[`profile.${key}`]}><input name={`profile.${key}`} className="field-input" type={type} required={key !== "backupContact"} maxLength={key === "bilibiliUid" ? 512 : undefined} placeholder={portalProfilePlaceholders[key]} value={form[key] ?? ""} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} />{key === "bilibiliUid" && getBilibiliProfileUrl(form.bilibiliUid) ? <a className="text-link" href={getBilibiliProfileUrl(form.bilibiliUid)} target="_blank" rel="noreferrer">访问我的 B站主页</a> : null}</Field>;
  return <ArchiveChapter enabled={compact} id="profile" number="01" title="署名与联系" state={profileState.profile?.creditName} defaultOpen={!profileState.profile}>
    <div className={embedded ? "space-y-6" : "page-content"}>
    {!embedded ? <PageHeading title="署名与联系" /> : null}
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
        {profileField("creditName", "署名")}
        <label className="checkbox-field"><input type="checkbox" checked={form.isAnonymous} onChange={event => setForm(current => ({ ...current, isAnonymous: event.target.checked }))} />匿名展示<span className="field-hint">仅隐藏公开署名，主催仍可见</span></label>
        {profileField("bilibiliUid", "B站主页链接或 UID")}
        <Field label="联系方式种类" error={fieldErrors["profile.primaryContactChannel"]}><select name="profile.primaryContactChannel" className="field-input" value={form.primaryContactChannel} onChange={event => setForm(current => ({ ...current, primaryContactChannel: event.target.value }))}>{!portalContactChannels.includes(form.primaryContactChannel) ? <option value={form.primaryContactChannel}>{form.primaryContactChannel}</option> : null}{portalContactChannels.map(channel => <option key={channel} value={channel}>{channel === "Email" ? "邮箱" : channel}</option>)}</select></Field>
        {profileField("primaryContactHandle", "联系方式内容")}
        {profileField("backupContact", "备用联系方式（选填）")}
        <p className="field-hint">请填写组委会能联系到你的方式，选择“其他”时请注明平台或渠道。联系方式需自行填写，与登录账号分开。</p>
        {refreshWarning ? <ArchiveResult compact={compact} tone="warning" message={refreshWarning} /> : null}
        {message ? <ArchiveResult compact={compact} message={message} /> : null}
        {error ? <ArchiveResult compact={compact} tone="error" message={error} /> : null}
        <div className="form-actions">
          {!embedded ? <Link className="button button--secondary" to="/portal">返回作者页面</Link> : null}
          <Button appearance={compact ? "industrial" : "default"} disabled={isSaving} aria-busy={isSaving} type="submit">{isSaving ? "保存中…" : continueToApplication ? "保存并继续报名" : "保存个人信息"}</Button>
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
