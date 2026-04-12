import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ApiError, requestJson } from "../../app/lib/api";
import { cn } from "../../app/lib/cn";
import { normalizeApplicationInput } from "../../app/lib/apply-form";
import {
  applicationInterestFormatLabels,
  applicationStatusLabels,
  type UpsertPortalApplicationInput,
  upsertPortalApplicationInputSchema,
} from "../../shared/applications";
import {
  participantPortalStatusLabels,
  type PortalApplicationMutationResponse,
  type PortalApplicationResponse,
} from "../../shared/portal";
import { authClient } from "../lib/auth-client";

const defaultFormState: UpsertPortalApplicationInput = {
  displayName: "",
  contactEmail: "",
  contactHandle: "",
  interestFormat: "novel",
  introText: "",
  portfolioUrl: "",
  messageToHosts: "",
};

const inputClassName =
  "w-full bg-surface-variant border border-outline-variant rounded-md px-4 py-2 focus:outline-none focus:border-primary font-mono text-sm disabled:opacity-50";

const textareaClassName =
  "w-full bg-surface-variant border border-outline-variant rounded-md px-4 py-2 focus:outline-none focus:border-primary font-mono text-sm resize-none disabled:opacity-50";

export function PortalApplicationPage() {
  const navigate = useNavigate();
  const sessionQuery = authClient.useSession();
  const [form, setForm] = useState<UpsertPortalApplicationInput>(defaultFormState);
  const [pageState, setPageState] = useState<PortalApplicationResponse | null>(null);
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

    void requestJson<PortalApplicationResponse>("/api/portal/application")
      .then((response) => {
        if (!cancelled) {
          setPageState(response);
          setForm(buildInitialApplicationForm(response));
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

        setError(caught instanceof Error ? caught.message : "无法读取当前报名资料。");
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, sessionQuery.data, sessionQuery.isPending]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!pageState) {
      return;
    }

    setMessage(null);
    setError(null);

    const normalized = normalizeApplicationInput({
      ...form,
      turnstileToken: undefined,
    });
    const { turnstileToken: _unused, ...payload } = normalized;
    const parsed = upsertPortalApplicationInputSchema.safeParse(payload);

    if (!parsed.success) {
      setError("请先补全必填字段，并检查邮箱或链接格式。");
      return;
    }

    setIsSaving(true);

    try {
      const response = await requestJson<PortalApplicationMutationResponse>("/api/portal/application", {
        method: pageState.editState === "create" ? "POST" : "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(parsed.data),
      });

      if (pageState.editState === "create") {
        await navigate({ to: "/apply/success" });
        return;
      }

      const refreshed = await requestJson<PortalApplicationResponse>("/api/portal/application");
      setPageState(refreshed);
      setForm(buildInitialApplicationForm(refreshed));
      setMessage(response.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "报名资料保存失败。");
    } finally {
      setIsSaving(false);
    }
  }

  if (sessionQuery.isPending || isLoading || !pageState) {
    return (
      <div className="max-w-4xl mx-auto relative z-10 py-6 space-y-8">
        <div className="border-b border-outline-variant pb-4">
          <h1 className="text-2xl font-headline tracking-tight mb-1">我的申请</h1>
          <p className="text-sm text-on-surface-variant">正在读取当前报名状态。</p>
        </div>
      </div>
    );
  }

  const editable = pageState.editable;
  const profileReady = Boolean(pageState.profile);
  const canSubmit = editable && profileReady;

  return (
    <div className="max-w-4xl mx-auto relative z-10 py-6 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-outline-variant pb-4">
        <div>
          <h1 className="text-2xl font-headline tracking-tight mb-1">我的申请</h1>
          <p className="text-sm text-on-surface-variant">正式报名会绑定当前登录邮箱，并以当前联系资料作为维护依据。</p>
        </div>
        <StatusBadge tone={resolveApplicationTone(pageState)}>
          {pageState.application ? applicationStatusLabels[pageState.application.status] : "未提交"}
        </StatusBadge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard label="当前状态" value={pageState.application ? applicationStatusLabels[pageState.application.status] : "未提交"} />
        <SummaryCard label="资料可编辑" value={editable ? (profileReady ? "可以编辑" : "待先补联系资料") : "已锁定"} />
        <SummaryCard label="联系资料" value={profileReady ? "已填写" : "待补充"} />
        <SummaryCard
          label="参与资格"
          value={pageState.participant ? participantPortalStatusLabels[pageState.participant.status] : "待审核"}
        />
      </div>

      {pageState.message ? <Notice>{pageState.message}</Notice> : null}
      {pageState.application?.adminNote ? <Notice tone="warning">主催备注：{pageState.application.adminNote}</Notice> : null}
      {!profileReady ? (
        <Notice tone="error">
          当前账号还没有完成联系资料。请先前往联系资料页补充笔名、联系方式和公开署名设置，再返回这里提交报名。
        </Notice>
      ) : null}

      <form className="space-y-6 bg-surface-container-low/50 border border-outline-variant rounded-xl p-6" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="笔名 / 署名（可选）" hint="不填写也可以，后台会用联系方式识别。">
            <input
              className={inputClassName}
              disabled={!canSubmit || isSaving}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              type="text"
              value={form.displayName}
            />
          </Field>
          <Field label="联系邮箱">
            <input
              className={inputClassName}
              disabled={!canSubmit || isSaving}
              onChange={(event) => setForm({ ...form, contactEmail: event.target.value })}
              type="email"
              value={form.contactEmail}
            />
          </Field>
          <Field label="联系方式备注">
            <input
              className={inputClassName}
              disabled={!canSubmit || isSaving}
              onChange={(event) => setForm({ ...form, contactHandle: event.target.value })}
              placeholder="QQ / Telegram / Discord / 其他"
              type="text"
              value={form.contactHandle ?? ""}
            />
          </Field>
          <Field label="参加形式">
            <select
              className={inputClassName}
              disabled={!canSubmit || isSaving}
              onChange={(event) =>
                setForm({
                  ...form,
                  interestFormat: event.target.value as UpsertPortalApplicationInput["interestFormat"],
                })
              }
              value={form.interestFormat}
            >
              {Object.entries(applicationInterestFormatLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="创作简介">
          <textarea
            className={textareaClassName}
            disabled={!canSubmit || isSaving}
            onChange={(event) => setForm({ ...form, introText: event.target.value })}
            rows={5}
            value={form.introText ?? ""}
          />
        </Field>

        <Field label="作品或主页链接">
          <input
            className={inputClassName}
            disabled={!canSubmit || isSaving}
            onChange={(event) => setForm({ ...form, portfolioUrl: event.target.value })}
            placeholder="https://example.com"
            type="url"
            value={form.portfolioUrl ?? ""}
          />
        </Field>

        <Field label="给主催的话">
          <textarea
            className={textareaClassName}
            disabled={!canSubmit || isSaving}
            onChange={(event) => setForm({ ...form, messageToHosts: event.target.value })}
            rows={5}
            value={form.messageToHosts ?? ""}
          />
        </Field>

        <div className="flex flex-wrap gap-3 pt-4 border-t border-outline-variant">
          <button
            className="px-6 py-2 bg-primary text-on-primary rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            disabled={!canSubmit || isSaving}
            type="submit"
          >
            {isSaving ? "保存中..." : pageState.editState === "create" ? "提交报名" : "更新报名"}
          </button>
          <Link
            className="px-6 py-2 bg-surface-variant text-on-surface rounded-md font-medium hover:bg-outline-variant transition-colors"
            to="/portal/profile"
          >
            {profileReady ? "返回联系资料" : "先补联系资料"}
          </Link>
          <Link
            className="px-6 py-2 bg-surface-variant text-on-surface rounded-md font-medium hover:bg-outline-variant transition-colors"
            to="/portal"
          >
            返回总览
          </Link>
        </div>
      </form>

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}

function buildInitialApplicationForm(response: PortalApplicationResponse): UpsertPortalApplicationInput {
  if (response.application) {
    return {
      displayName: response.application.displayName,
      contactEmail: response.application.contactEmail,
      contactHandle: response.application.contactHandle ?? "",
      interestFormat: response.application.interestFormat,
      introText: response.application.introText ?? "",
      portfolioUrl: response.application.portfolioUrl ?? "",
      messageToHosts: response.application.messageToHosts ?? "",
    };
  }

  const contactHandle = response.profile
    ? `${response.profile.primaryContactChannel}: ${response.profile.primaryContactHandle}`
    : "";

  return {
    displayName:
      response.profile?.publicCreditMode === "named"
        ? response.profile.penName ?? ""
        : response.profile?.publicCreditMode === "pseudonymous"
          ? response.profile.publicCreditName ?? ""
          : "",
    contactEmail: response.profile?.contactEmail ?? response.user.email,
    contactHandle,
    interestFormat: "novel",
    introText: "",
    portfolioUrl: "",
    messageToHosts: "",
  };
}

function resolveApplicationTone(pageState: PortalApplicationResponse): "muted" | "warning" | "success" | "error" {
  if (!pageState.application) {
    return "muted";
  }

  if (pageState.application.status === "approved") {
    return "success";
  }

  if (pageState.application.status === "pending") {
    return "warning";
  }

  return "error";
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low/50 p-4">
      <p className="text-xs font-mono uppercase text-on-surface-variant">{label}</p>
      <p className="mt-2 text-sm text-on-surface">{value}</p>
    </div>
  );
}

function Field({
  children,
  hint,
  label,
}: {
  children: ReactNode;
  hint?: string;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-on-surface-variant">{label}</label>
      {children}
      {hint ? <p className="text-xs text-on-surface-variant">{hint}</p> : null}
    </div>
  );
}

function StatusBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "muted" | "warning" | "success" | "error";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono font-medium",
        tone === "success" && "bg-tertiary/10 text-tertiary border-tertiary/20",
        tone === "warning" && "bg-primary/10 text-primary border-primary/20",
        tone === "error" && "bg-error/10 text-error border-error/20",
        tone === "muted" && "bg-surface-variant text-on-surface-variant border-outline-variant",
      )}
    >
      {children}
    </span>
  );
}

function Notice({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "warning" | "success" | "error";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm leading-6",
        tone === "muted" && "border-outline-variant bg-surface-container-low/50 text-on-surface-variant",
        tone === "warning" && "border-primary/20 bg-primary/10 text-primary",
        tone === "success" && "border-tertiary/20 bg-tertiary/10 text-tertiary",
        tone === "error" && "border-error/20 bg-error/10 text-error",
      )}
    >
      {children}
    </div>
  );
}
