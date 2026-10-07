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
import { PasswordSettings } from "../components/PasswordSettings";
import { authClient } from "../lib/auth-client";
import { normalizePortalProfileInput } from "../lib/profile-form";

const defaultFormState: UpdatePortalProfileInput = {
  creditName: "",
  contactEmail: "",
  primaryContactChannel: "Email",
  primaryContactHandle: "",
  backupContact: "",
  isAnonymous: true,
};

export function PortalProfilePage({ embedded = false, onSaved }: { embedded?: boolean; onSaved?: () => Promise<void> } = {}) {
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
          caught instanceof Error ? caught.message : "无法读取当前联系资料。",
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

    const normalized = normalizePortalProfileInput(form);
    const parsed = updatePortalProfileInputSchema.safeParse(normalized);

    if (!parsed.success) {
      setError("请填写署名、联系邮箱和联系账号。");
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
      await onSaved?.().catch(() => setRefreshWarning("操作已完成，但摘要暂未更新，请稍后刷新。"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "资料保存失败。");
    } finally {
      setIsSaving(false);
    }
  }

  if (sessionQuery.isPending || isLoading) {
    return (
      <PageHeading
        title={<>个人档案</>}
        description={<>正在读取当前资料。</>}
      ></PageHeading>
    );
  }

  if (!profileState) {
    return (
      <div className={embedded ? "space-y-6" : "page-content"}>
        <PageHeading title="个人档案" />
        <ReadError message={error || "暂时无法读取个人档案。"} />
      </div>
    );
  }

  const continueToApplication = !embedded && !profileState.profile && !profileState.application;

  return (
    <div className={embedded ? "space-y-6" : "page-content"}>
      {!embedded ? <PageHeading
        eyebrow="PROFILE / 01"
        title="个人档案"
        description="让主催找到你，也让作品以你希望的名字被看见。"
      /> : null}
      <form className="panel space-y-6" onSubmit={handleSubmit}>
        <fieldset className="form-section">
          <legend>署名</legend>
          <p>报名与作品统一使用这里的设置。</p>
          <Field label="署名" hint="填写你希望使用的名字，笔名或社团名均可。">
            <input
              className="field-input"
              required
              maxLength={80}
              value={form.creditName}
              onChange={(event) =>
                setForm({ ...form, creditName: event.target.value })
              }
            />
          </Field>
          <label className="flex items-center gap-3 mt-6 min-h-11">
            <input
              type="checkbox"
              checked={form.isAnonymous}
              onChange={(event) =>
                setForm({ ...form, isAnonymous: event.target.checked })
              }
            />
            匿名展示
          </label>
          <p>匿名只影响公开展示。开启后，对外显示“匿名”；主催仍可查看你填写的署名和联系方式。</p>
        </fieldset>
        <fieldset className="form-section">
          <legend>联系与沟通</legend>
          <p>联系方式仅用于主催与你沟通。</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="联系邮箱">
              <input
                className="field-input"
                onChange={(event) =>
                  setForm({ ...form, contactEmail: event.target.value })
                }
                type="email"
                value={form.contactEmail}
              />
            </Field>
            <Field label="联系渠道">
              <input
                className="field-input"
                onChange={(event) =>
                  setForm({
                    ...form,
                    primaryContactChannel: event.target.value,
                  })
                }
                placeholder="Email / QQ / Telegram / Discord / Bluesky"
                type="text"
                value={form.primaryContactChannel}
              />
            </Field>
            <Field label="联系账号">
              <input
                className="field-input"
                onChange={(event) =>
                  setForm({ ...form, primaryContactHandle: event.target.value })
                }
                placeholder="@handle / 号码 / 邮箱"
                type="text"
                value={form.primaryContactHandle}
              />
            </Field>
            <Field label="备用联系方式（选填）">
              <input
                className="field-input"
                onChange={(event) =>
                  setForm({ ...form, backupContact: event.target.value })
                }
                type="text"
                value={form.backupContact ?? ""}
              />
            </Field>
          </div>
        </fieldset>
        {refreshWarning ? <Notice tone="warning">{refreshWarning}</Notice> : null}
        {message ? <Notice tone="success">{message}</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <div className="form-actions">
          {!embedded ? <Link className="button button--secondary" to="/portal">返回工作台</Link> : null}
          <Button
            disabled={isSaving}
            aria-busy={isSaving}
            type="submit"
          >
            {isSaving ? "保存中..." : continueToApplication ? "保存并继续报名" : "保存更改"}
          </Button>
        </div>
      </form>
      <PasswordSettings />
    </div>
  );
}

function buildInitialProfileForm(
  response: PortalProfileResponse,
): UpdatePortalProfileInput {
  if (response.profile) {
    return {
      creditName: response.profile.creditName ?? "",
      contactEmail: response.profile.contactEmail,
      primaryContactChannel: response.profile.primaryContactChannel,
      primaryContactHandle: response.profile.primaryContactHandle,
      backupContact: response.profile.backupContact ?? "",
      isAnonymous: response.profile.isAnonymous,
    };
  }

  return {
    creditName: "",
    contactEmail: response.user.email,
    primaryContactChannel: "Email",
    primaryContactHandle: response.user.email,
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
