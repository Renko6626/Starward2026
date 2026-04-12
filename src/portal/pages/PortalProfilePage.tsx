import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ApiError, requestJson } from "../../app/lib/api";
import type { PortalProfileMutationResponse, PortalProfileResponse, UpdatePortalProfileInput } from "../../shared/portal";
import { updatePortalProfileInputSchema } from "../../shared/portal";
import { authClient } from "../lib/auth-client";
import { normalizePortalProfileInput } from "../lib/profile-form";

const defaultFormState: UpdatePortalProfileInput = {
  penName: "",
  contactEmail: "",
  primaryContactChannel: "Email",
  primaryContactHandle: "",
  backupContact: "",
  publicCreditMode: "anonymous",
  publicCreditName: "",
};

export function PortalProfilePage() {
  const navigate = useNavigate();
  const sessionQuery = authClient.useSession();
  const [form, setForm] = useState<UpdatePortalProfileInput>(defaultFormState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionQuery.isPending && !sessionQuery.data) {
      void navigate({ to: "/portal/login" });
      return;
    }

    if (!sessionQuery.data) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void requestJson<PortalProfileResponse>("/api/portal/profile")
      .then((response) => {
        if (!cancelled) {
          setForm(buildInitialProfileForm(response));
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

        setError(caught instanceof Error ? caught.message : "无法读取当前联系资料。");
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, sessionQuery.data, sessionQuery.isPending]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const normalized = normalizePortalProfileInput(form);
    const parsed = updatePortalProfileInputSchema.safeParse(normalized);

    if (!parsed.success) {
      setError("请先补全主联系资料；若选择常用笔名公开或单独署名，请补足对应署名字段。");
      return;
    }

    setIsSaving(true);

    try {
      const response = await requestJson<PortalProfileMutationResponse>("/api/portal/profile", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(parsed.data),
      });

      setForm(buildInitialProfileFormFromMutation(parsed.data));
      setMessage(response.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "资料保存失败。");
    } finally {
      setIsSaving(false);
    }
  }

  if (sessionQuery.isPending || isLoading) {
    return (
      <div className="w-full max-w-3xl mx-auto relative z-10 py-6 space-y-8">
        <div>
          <h1 className="text-2xl font-headline tracking-tight mb-1">创作者档案</h1>
          <p className="text-sm text-on-surface-variant">正在读取当前资料。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto relative z-10 py-6 space-y-8">
      <div>
        <h1 className="text-2xl font-headline tracking-tight mb-1">创作者档案</h1>
        <p className="text-sm text-on-surface-variant">更新您的参企信息与展示资料。对外匿名，不等于对主催匿名。</p>
      </div>
      <form className="space-y-6 bg-surface-container-low/50 border border-outline-variant rounded-xl p-6" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="常用昵称/社团名">
            <input className="w-full bg-surface-variant border border-outline-variant rounded-md px-4 py-2 focus:outline-none focus:border-primary font-mono text-sm" onChange={(event) => setForm({ ...form, penName: event.target.value })} type="text" value={form.penName ?? ""} />
          </Field>
          <Field label="联系邮箱">
            <input className="w-full bg-surface-variant border border-outline-variant rounded-md px-4 py-2 focus:outline-none focus:border-primary font-mono text-sm" onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} type="email" value={form.contactEmail} />
          </Field>
          <Field label="主联系渠道">
            <input className="w-full bg-surface-variant border border-outline-variant rounded-md px-4 py-2 focus:outline-none focus:border-primary font-mono text-sm" onChange={(event) => setForm({ ...form, primaryContactChannel: event.target.value })} placeholder="Email / QQ / Telegram / Discord / Bluesky" type="text" value={form.primaryContactChannel} />
          </Field>
          <Field label="主联系标识">
            <input className="w-full bg-surface-variant border border-outline-variant rounded-md px-4 py-2 focus:outline-none focus:border-primary font-mono text-sm" onChange={(event) => setForm({ ...form, primaryContactHandle: event.target.value })} placeholder="@handle / 号码 / 邮箱" type="text" value={form.primaryContactHandle} />
          </Field>
          <Field label="备用联系方式">
            <input className="w-full bg-surface-variant border border-outline-variant rounded-md px-4 py-2 focus:outline-none focus:border-primary font-mono text-sm" onChange={(event) => setForm({ ...form, backupContact: event.target.value })} type="text" value={form.backupContact ?? ""} />
          </Field>
          <Field label="公开署名模式">
            <select
              className="w-full bg-surface-variant border border-outline-variant rounded-md px-4 py-2 focus:outline-none focus:border-primary font-mono text-sm"
              onChange={(event) => {
                const publicCreditMode = event.target.value as UpdatePortalProfileInput["publicCreditMode"];
                setForm({
                  ...form,
                  publicCreditMode,
                  publicCreditName: publicCreditMode === "pseudonymous" ? form.publicCreditName : "",
                });
              }}
              value={form.publicCreditMode}
            >
              <option value="named">使用常用笔名</option>
              <option value="pseudonymous">使用单独署名</option>
              <option value="anonymous">匿名参与</option>
            </select>
          </Field>
        </div>
        <Field label="公开署名 / 备用名义">
          <input className="w-full bg-surface-variant border border-outline-variant rounded-md px-4 py-2 focus:outline-none focus:border-primary font-mono text-sm disabled:opacity-50" disabled={form.publicCreditMode !== "pseudonymous"} onChange={(event) => setForm({ ...form, publicCreditName: event.target.value })} placeholder="例如：境界观测者" type="text" value={form.publicCreditName ?? ""} />
          <p className="text-xs text-on-surface-variant mt-2">选择“单独署名”时必须填写；匿名参与时不会对外显示署名。</p>
        </Field>
        <div className="flex justify-end pt-4 border-t border-outline-variant gap-3 flex-wrap">
          <Link className="px-6 py-2 bg-surface-variant text-on-surface rounded-md font-medium hover:bg-outline-variant transition-colors" to="/portal">
            返回工作台
          </Link>
          <Link className="px-6 py-2 bg-surface-variant text-on-surface rounded-md font-medium hover:bg-outline-variant transition-colors" to="/portal/application">
            前往报名页
          </Link>
          <button className="px-6 py-2 bg-primary text-on-primary rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50" disabled={isSaving} type="submit">
            {isSaving ? "保存中..." : "保存更改"}
          </button>
        </div>
      </form>
      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-on-surface-variant">{label}</label>
      {children}
    </div>
  );
}

function Notice({ children, tone }: { children: string; tone: "success" | "error" }) {
  const toneClass = tone === "success" ? "border-tertiary/20 bg-tertiary/10 text-tertiary" : "border-error/20 bg-error/10 text-error";
  return <div className={`rounded-xl border px-4 py-3 text-sm leading-6 ${toneClass}`}>{children}</div>;
}

function buildInitialProfileForm(response: PortalProfileResponse): UpdatePortalProfileInput {
  if (response.profile) {
    return {
      penName: response.profile.penName ?? "",
      contactEmail: response.profile.contactEmail,
      primaryContactChannel: response.profile.primaryContactChannel,
      primaryContactHandle: response.profile.primaryContactHandle,
      backupContact: response.profile.backupContact ?? "",
      publicCreditMode: response.profile.publicCreditMode,
      publicCreditName: response.profile.publicCreditName ?? "",
    };
  }

  return {
    penName: "",
    contactEmail: response.user.email,
    primaryContactChannel: "Email",
    primaryContactHandle: response.user.email,
    backupContact: "",
    publicCreditMode: "anonymous",
    publicCreditName: "",
  };
}

function buildInitialProfileFormFromMutation(input: UpdatePortalProfileInput): UpdatePortalProfileInput {
  return {
    ...input,
    backupContact: input.backupContact ?? "",
    publicCreditName: input.publicCreditName ?? "",
    penName: input.penName ?? "",
  };
}
