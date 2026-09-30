import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Field,
  Notice,
  PageHeading,
  StatusBadge,
  SummaryCard,
  ReadError,
} from "../../app/components/ui";
import { ApiError, requestJson } from "../../app/lib/api";
import {
  getTurnstileSiteKey,
  normalizeApplicationInput,
} from "../../app/lib/apply-form";
import { loadTurnstileApi } from "../../app/lib/turnstile";
import {
  applicationInterestFormatLabels,
  applicationStatusLabels,
  upsertPortalApplicationInputSchema,
  type ApplicationIntakeResponse,
  type UpsertPortalApplicationInput,
} from "../../shared/applications";
import {
  participantPortalStatusLabels,
  type PortalApplicationMutationResponse,
  type PortalApplicationResponse,
} from "../../shared/portal";
import { getApplicationWindowLabel } from "../../shared/windows";
import { authClient } from "../lib/auth-client";

const defaultFormState: UpsertPortalApplicationInput = {
  contactEmail: "",
  contactHandle: "",
  interestFormat: "novel",
  introText: "",
  portfolioUrl: "",
  messageToHosts: "",
};

const inputClassName = "field-input";

const textareaClassName = "field-input min-h-32 resize-y";

export function PortalApplicationPage() {
  const navigate = useNavigate();
  const sessionQuery = authClient.useSession();
  const [form, setForm] =
    useState<UpsertPortalApplicationInput>(defaultFormState);
  const [pageState, setPageState] = useState<PortalApplicationResponse | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);

  const turnstileSiteKey = getTurnstileSiteKey(import.meta.env);
  const turnstileRequired = turnstileEnabled && Boolean(turnstileSiteKey);

  useEffect(() => {
    let cancelled = false;

    void requestJson<ApplicationIntakeResponse>("/api/applications/intake")
      .then((response) => {
        if (!cancelled) {
          setTurnstileEnabled(response.turnstileEnabled);
        }
      })
      .catch(() => {
        // Intake failures should not block the form; Turnstile stays disabled.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      !turnstileRequired ||
      !turnstileSiteKey ||
      !pageState ||
      !turnstileContainerRef.current
    ) {
      return;
    }

    let cancelled = false;
    let widgetId: string | undefined;
    const container = turnstileContainerRef.current;

    void loadTurnstileApi()
      .then((api) => {
        if (cancelled || !container) {
          return;
        }

        widgetId = api.render(container, {
          sitekey: turnstileSiteKey,
          callback: (token) => setTurnstileToken(token),
          "expired-callback": () => setTurnstileToken(null),
          "error-callback": () => setTurnstileToken(null),
        });
      })
      .catch(() => {
        // If the widget fails to load, leave the token empty so submit is blocked.
      });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile?.remove) {
        window.turnstile.remove(widgetId);
      }
    };
  }, [turnstileRequired, turnstileSiteKey, pageState]);

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

        setError(
          caught instanceof Error ? caught.message : "无法读取当前报名资料。",
        );
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
      turnstileToken: turnstileToken ?? undefined,
    });
    const { turnstileToken: token, ...payload } = normalized;
    const parsed = upsertPortalApplicationInputSchema.safeParse(payload);

    if (!parsed.success) {
      setError("请先补全必填字段，并检查邮箱或链接格式。");
      return;
    }

    if (turnstileRequired && !token) {
      setError("请先完成人机验证后再提交。");
      return;
    }

    setIsSaving(true);

    try {
      const response = await requestJson<PortalApplicationMutationResponse>(
        "/api/portal/application",
        {
          method: pageState.editState === "create" ? "POST" : "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(
            token ? { ...parsed.data, turnstileToken: token } : parsed.data,
          ),
        },
      );

      if (pageState.editState === "create") {
        await navigate({ to: "/apply/success" });
        return;
      }

      const refreshed = await requestJson<PortalApplicationResponse>(
        "/api/portal/application",
      );
      setPageState(refreshed);
      setForm(buildInitialApplicationForm(refreshed));
      setMessage(response.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "报名资料保存失败。");
    } finally {
      setIsSaving(false);
      if (turnstileRequired) {
        // Turnstile tokens are single-use; clear and reset for any follow-up submit.
        setTurnstileToken(null);
        window.turnstile?.reset();
      }
    }
  }

  if (sessionQuery.isPending || isLoading) {
    return (
      <PageHeading
        title={<>参与报名</>}
        description={<>正在读取当前报名状态。</>}
      ></PageHeading>
    );
  }

  if (!pageState) {
    return (
      <div className="page-content">
        <PageHeading title="参与报名" />
        <ReadError message={error || "暂时无法读取报名状态。"} />
      </div>
    );
  }

  const editable = pageState.editable;
  const profileReady = Boolean(pageState.profile);
  const canSubmit = editable && profileReady;

  return (
    <div className="page-content">
      <PageHeading
        title={<>参与报名</>}
        description={
          <>填写创作意向并提交报名，在这里查看审核进度与反馈。</>
        }
      >
        <StatusBadge tone={resolveApplicationTone(pageState)}>
          {pageState.application
            ? applicationStatusLabels[pageState.application.status]
            : "报名未提交"}
        </StatusBadge>
      </PageHeading>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          label="当前状态"
          value={
            pageState.application
              ? applicationStatusLabels[pageState.application.status]
              : "报名未提交"
          }
        />
        <SummaryCard
          label="资料可编辑"
          value={
            editable ? (profileReady ? "可以编辑" : "待完善个人档案") : "暂不可修改"
          }
        />
        <SummaryCard
          label="个人档案"
          value={profileReady ? "已填写" : "待补充"}
        />
        <SummaryCard
          label="参与资格"
          value={
            pageState.participant
              ? participantPortalStatusLabels[pageState.participant.status]
              : "待审核"
          }
        />
      </div>

      {profileReady && pageState.message ? (
        <Notice>{pageState.application?.status === "approved"
          ? "报名已审核通过，暂时不能修改报名。"
          : !pageState.window.isOpen
            ? `${getApplicationWindowLabel(pageState.window)}，暂时不能${pageState.application ? "修改" : "提交"}报名。`
            : pageState.message}</Notice>
      ) : null}
      {pageState.application?.adminNote ? (
        <Notice tone="warning">
          审核意见：{pageState.application.adminNote}
        </Notice>
      ) : null}
      {!profileReady ? (
        <Notice>
          {pageState.application?.status === "approved"
            ? "报名已通过，请补充个人档案。"
            : pageState.application
              ? "报名已提交，请补充个人档案中的署名和联系方式。"
              : "请先完善个人档案，再提交报名。"}
          <Link className="text-link" to="/portal/profile">完善个人档案</Link>
        </Notice>
      ) : null}

      <form className="panel space-y-6" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <p>署名：{pageState.profile?.creditName ?? "未填写"}</p>
            <p className="text-sm text-on-surface-variant">
              对外展示：
              {pageState.profile?.isAnonymous
                ? "匿名"
                : pageState.profile?.creditName ?? "未填写"}
            </p>
            <Link className="text-link" to="/portal/profile">
              修改个人档案
            </Link>
          </div>
          <Field label="联系邮箱">
            <input
              className={inputClassName}
              disabled={!canSubmit || isSaving}
              onChange={(event) =>
                setForm({ ...form, contactEmail: event.target.value })
              }
              type="email"
              value={form.contactEmail}
            />
          </Field>
          <Field label="联系方式备注">
            <input
              className={inputClassName}
              disabled={!canSubmit || isSaving}
              onChange={(event) =>
                setForm({ ...form, contactHandle: event.target.value })
              }
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
                  interestFormat: event.target
                    .value as UpsertPortalApplicationInput["interestFormat"],
                })
              }
              value={form.interestFormat}
            >
              {Object.entries(applicationInterestFormatLabels).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </Field>
        </div>

        <Field label="创作简介">
          <textarea
            className={textareaClassName}
            disabled={!canSubmit || isSaving}
            onChange={(event) =>
              setForm({ ...form, introText: event.target.value })
            }
            rows={5}
            value={form.introText ?? ""}
          />
        </Field>

        <Field label="作品或主页链接">
          <input
            className={inputClassName}
            disabled={!canSubmit || isSaving}
            onChange={(event) =>
              setForm({ ...form, portfolioUrl: event.target.value })
            }
            placeholder="https://example.com"
            type="url"
            value={form.portfolioUrl ?? ""}
          />
        </Field>

        <Field label="给主催的话">
          <textarea
            className={textareaClassName}
            disabled={!canSubmit || isSaving}
            onChange={(event) =>
              setForm({ ...form, messageToHosts: event.target.value })
            }
            rows={5}
            value={form.messageToHosts ?? ""}
          />
        </Field>

        {turnstileRequired && canSubmit ? (
          <Field label="人机验证" hint="提交前请完成下方的人机验证。">
            <div ref={turnstileContainerRef} />
          </Field>
        ) : null}

        <div className="flex flex-wrap gap-3 pt-4 border-t border-outline-variant">
          <button
            className="button button--primary"
            disabled={
              !canSubmit || isSaving || (turnstileRequired && !turnstileToken)
            }
            type="submit"
          >
            {isSaving
              ? "保存中..."
              : pageState.editState === "create"
                ? "提交报名"
                : "更新报名"}
          </button>
          <Link className="button button--secondary" to="/portal/profile">
            {profileReady ? "编辑个人档案" : "完善个人档案"}
          </Link>
          <Link className="button button--secondary" to="/portal">
            返回工作台
          </Link>
        </div>
      </form>

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}

function buildInitialApplicationForm(
  response: PortalApplicationResponse,
): UpsertPortalApplicationInput {
  if (response.application) {
    return {
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
    contactEmail: response.profile?.contactEmail ?? response.user.email,
    contactHandle,
    interestFormat: "novel",
    introText: "",
    portfolioUrl: "",
    messageToHosts: "",
  };
}

function resolveApplicationTone(
  pageState: PortalApplicationResponse,
): "muted" | "warning" | "success" | "error" {
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
