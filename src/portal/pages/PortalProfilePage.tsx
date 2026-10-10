import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Field, Notice, PageHeading, ReadError } from "../../app/components/ui";
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

    const normalized = normalizePortalProfileInput(form, profileState?.user.email);
    const parsed = updatePortalProfileInputSchema.safeParse(normalized);

    if (!parsed.success) {
      setError("请填写署名、有效的 B站主页链接或 UID、联系账号。");
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

  const profileField = (key: "creditName" | "bilibiliUid" | "contactEmail" | "primaryContactChannel" | "primaryContactHandle" | "backupContact", label: string, type = "text") => <Field label={label}><input className="field-input" type={type} required={key !== "backupContact"} maxLength={key === "bilibiliUid" ? 512 : undefined} placeholder={portalProfilePlaceholders[key]} value={form[key] ?? ""} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} />{key === "bilibiliUid" && getBilibiliProfileUrl(form.bilibiliUid) ? <a className="text-link" href={getBilibiliProfileUrl(form.bilibiliUid)} target="_blank" rel="noreferrer">访问我的 B站主页</a> : null}</Field>;
  return <div className={compact ? "creator-card creator-profile-card" : embedded ? "space-y-6" : "page-content"} id={compact ? "profile" : undefined}>
    {compact ? <header className="creator-card-header"><h2 className="creator-card-title">署名与联系</h2><LoginPasswordDialog email={profileState.user.email} /></header> : !embedded ? <PageHeading title="署名与联系" /> : null}
    <div className={compact ? "creator-card-body" : undefined}>
      <form className={compact ? "space-y-4" : "panel space-y-6"} onSubmit={handleSubmit}>
        {profileField("creditName", "署名")}
        <label className="checkbox-field"><input type="checkbox" checked={form.isAnonymous} onChange={event => setForm(current => ({ ...current, isAnonymous: event.target.checked }))} />匿名展示<span className="field-hint">仅隐藏公开署名，主催仍可见</span></label>
        {profileField("bilibiliUid", "B站主页链接或 UID")}
        <Field label="注册邮箱"><input className="field-input" type="email" readOnly value={profileState.user.email} /></Field>
        <Field label="联系方式"><select className="field-input" value={form.primaryContactChannel} onChange={event => setForm(current => ({ ...current, primaryContactChannel: event.target.value }))}>{!portalContactChannels.includes(form.primaryContactChannel) ? <option value={form.primaryContactChannel}>{form.primaryContactChannel}</option> : null}{portalContactChannels.map(channel => <option key={channel} value={channel}>{channel === "Email" ? "邮箱" : channel}</option>)}</select></Field>
        {profileField("primaryContactHandle", "联系账号")}
        {profileField("backupContact", "备用联系方式（选填）")}
        {refreshWarning ? <Notice tone="warning">{refreshWarning}</Notice> : null}
        {message ? <Notice tone="success">{message}</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <div className="form-actions">
          {!embedded ? <Link className="button button--secondary" to="/portal">返回作者页面</Link> : null}
          <Button disabled={isSaving} aria-busy={isSaving} type="submit">{isSaving ? "保存中…" : continueToApplication ? "保存并继续报名" : "保存个人信息"}</Button>
        </div>
      </form>
      {!compact ? <LoginPasswordDialog email={profileState.user.email} /> : null}
    </div>
  </div>;
}

function buildInitialProfileForm(
  response: PortalProfileResponse,
): UpdatePortalProfileInput {
  if (response.profile) {
    return {
      creditName: response.profile.creditName ?? "",
      bilibiliUid: response.profile.bilibiliUid ?? "",
      contactEmail: response.user.email,
      primaryContactChannel: response.profile.primaryContactChannel,
      primaryContactHandle: response.profile.primaryContactHandle,
      backupContact: response.profile.backupContact ?? "",
      isAnonymous: response.profile.isAnonymous,
    };
  }

  return {
    creditName: "",
    bilibiliUid: "",
    contactEmail: response.user.email,
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
