import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ApiError, requestJson } from "../../app/lib/api";
import { cn } from "../../app/lib/cn";
import { formatDateTime } from "../../app/lib/format";
import type {
  PortalProjectDraftDetail,
  PortalProjectMutationResponse,
  PortalProjectResponse,
  UpdatePortalProjectPreviewInput,
  UpdatePortalProjectReviewInput,
} from "../../shared/portal";
import { projectDraftStatusLabels } from "../../shared/portal";
import { buildWindowFlagMap } from "../../shared/windows";
import { authClient } from "../lib/auth-client";

type ProjectPageState =
  | { status: "loading" }
  | { status: "ready"; project: PortalProjectResponse }
  | { status: "error"; message: string };

type PreviewFormState = {
  previewTitle: string;
  previewSummary: string;
  publicAuthorName: string;
  formatLabel: string;
  publicTagsText: string;
};

type ReviewFormState = {
  contentNote: string;
  contentWarnings: string;
  reviewNote: string;
};

type PendingAction =
  | "preview-save"
  | "preview-submit"
  | "review-save"
  | "review-submit"
  | null;

const inputClassName =
  "w-full bg-surface-variant border border-outline-variant rounded-md px-4 py-2 focus:outline-none focus:border-primary font-mono text-sm disabled:opacity-50";

const textareaClassName =
  "w-full bg-surface-variant border border-outline-variant rounded-md px-4 py-2 focus:outline-none focus:border-primary font-mono text-sm resize-none disabled:opacity-50";

export function PortalProjectPage() {
  const navigate = useNavigate();
  const sessionQuery = authClient.useSession();
  const [state, setState] = useState<ProjectPageState>({ status: "loading" });
  const [previewForm, setPreviewForm] = useState<PreviewFormState>(emptyPreviewForm);
  const [reviewForm, setReviewForm] = useState<ReviewFormState>(emptyReviewForm);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionQuery.isPending && !sessionQuery.data) {
      void navigate({ to: "/portal/login" });
      return;
    }

    if (!sessionQuery.data) {
      return;
    }

    void loadProjectPage();
  }, [navigate, sessionQuery.data, sessionQuery.isPending]);

  async function loadProjectPage() {
    setState({ status: "loading" });

    try {
      const project = await requestJson<PortalProjectResponse>("/api/portal/project");
      applyLoadedProject(project);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        void navigate({ to: "/portal/login" });
        return;
      }

      setState({
        status: "error",
        message: caught instanceof Error ? caught.message : "无法读取作品资料。",
      });
    }
  }

  function applyLoadedProject(project: PortalProjectResponse) {
    setPreviewForm(buildPreviewForm(project.draft));
    setReviewForm(buildReviewForm(project.draft));
    setState({ status: "ready", project });
  }

  function updateDraft(draft: PortalProjectDraftDetail) {
    setPreviewForm(buildPreviewForm(draft));
    setReviewForm(buildReviewForm(draft));
    setState((current) =>
      current.status === "ready"
        ? {
            status: "ready",
            project: {
              ...current.project,
              draft,
            },
          }
        : current,
    );
  }

  async function patchPreview(quiet = false) {
    const response = await requestJson<PortalProjectMutationResponse>("/api/portal/project/preview", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        previewTitle: previewForm.previewTitle,
        previewSummary: previewForm.previewSummary,
        publicAuthorName: previewForm.publicAuthorName,
        formatLabel: previewForm.formatLabel,
        publicTags: parseTagsText(previewForm.publicTagsText),
      } satisfies UpdatePortalProjectPreviewInput),
    });

    updateDraft(response.draft);

    if (!quiet) {
      setNotice(response.message);
    }
  }

  async function patchReview(quiet = false) {
    const response = await requestJson<PortalProjectMutationResponse>("/api/portal/project/review", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contentNote: reviewForm.contentNote,
        contentWarnings: reviewForm.contentWarnings,
        reviewNote: reviewForm.reviewNote,
      } satisfies UpdatePortalProjectReviewInput),
    });

    updateDraft(response.draft);

    if (!quiet) {
      setNotice(response.message);
    }
  }

  async function handlePreviewSave() {
    setPendingAction("preview-save");
    setNotice(null);

    try {
      await patchPreview();
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "保存预告信息失败。");
    } finally {
      setPendingAction(null);
    }
  }

  async function handlePreviewSubmit() {
    setPendingAction("preview-submit");
    setNotice(null);

    try {
      await patchPreview(true);

      const response = await requestJson<PortalProjectMutationResponse>("/api/portal/project/preview/submit", {
        method: "POST",
      });

      updateDraft(response.draft);
      setNotice(response.message);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "提交预告资料失败。");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleReviewSave() {
    setPendingAction("review-save");
    setNotice(null);

    try {
      await patchReview();
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "保存审查说明失败。");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleReviewSubmit() {
    setPendingAction("review-submit");
    setNotice(null);

    try {
      await patchReview(true);

      const response = await requestJson<PortalProjectMutationResponse>("/api/portal/project/review/submit", {
        method: "POST",
      });

      updateDraft(response.draft);
      setNotice(response.message);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "提交审查说明失败。");
    } finally {
      setPendingAction(null);
    }
  }

  if (sessionQuery.isPending || state.status === "loading") {
    return (
      <div className="max-w-6xl mx-auto relative z-10 py-6 space-y-8">
        <div className="border-b border-outline-variant pb-4">
          <h1 className="text-2xl font-headline tracking-tight mb-1">接力稿件提交</h1>
          <p className="text-sm text-on-surface-variant">正在读取当前作品资料状态。</p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="max-w-6xl mx-auto relative z-10 py-6 space-y-8">
        <div className="border-b border-outline-variant pb-4">
          <h1 className="text-2xl font-headline tracking-tight mb-1">接力稿件提交</h1>
          <p className="text-sm text-on-surface-variant">{state.message}</p>
        </div>
      </div>
    );
  }

  const flags = buildWindowFlagMap(state.project.windows);

  return (
    <div className="max-w-6xl mx-auto relative z-10 py-6 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-outline-variant pb-4">
        <div>
          <h1 className="text-2xl font-headline tracking-tight mb-1">接力稿件提交</h1>
          <p className="text-sm text-on-surface-variant">
            {state.project.participant.displayName}，先把可公开预告和给主催看的审查说明分别补全，再在开放窗口内提交。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={getStatusTone(state.project.draft.previewStatus)}>
            预告：{projectDraftStatusLabels[state.project.draft.previewStatus]}
          </StatusBadge>
          <StatusBadge tone={getStatusTone(state.project.draft.reviewStatus)}>
            审查：{projectDraftStatusLabels[state.project.draft.reviewStatus]}
          </StatusBadge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          label="当前时间段"
          value={
            state.project.participant.currentSegmentCode
              ? `${state.project.participant.currentSegmentCode} · ${state.project.participant.currentSegmentName ?? "未命名"}`
              : "尚未认领"
          }
        />
        <SummaryCard label="预告提交" value={flags.previewSubmitOpen ? "已开放" : "未开放"} />
        <SummaryCard label="审查提交" value={flags.reviewSubmitOpen ? "已开放" : "未开放"} />
        <SummaryCard label="最近更新" value={formatDateTime(state.project.draft.updatedAt)} />
      </div>

      {state.project.draft.adminFeedback ? (
        <Notice tone="warning">
          <div className="font-medium">主催反馈</div>
          <div className="mt-2">{state.project.draft.adminFeedback}</div>
          <div className="mt-2 text-xs">最近审核时间：{formatDateTime(state.project.draft.reviewedAt)}</div>
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="space-y-6 bg-surface-container-low/50 border border-outline-variant rounded-xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium text-on-surface">预告信息</h2>
              <p className="text-sm text-on-surface-variant mt-1">这里填写的是之后可能对外展示的标题、简介、作者名和标签。</p>
            </div>
            <StatusBadge tone={getStatusTone(state.project.draft.previewStatus)}>
              {projectDraftStatusLabels[state.project.draft.previewStatus]}
            </StatusBadge>
          </div>

          <div className="space-y-4">
            <Field label="预告标题">
              <input
                className={inputClassName}
                disabled={pendingAction !== null}
                onChange={(event) =>
                  setPreviewForm((current) => ({
                    ...current,
                    previewTitle: event.target.value,
                  }))
                }
                placeholder="例如：边界面浮上试验"
                type="text"
                value={previewForm.previewTitle}
              />
            </Field>

            <Field label="公开作者名">
              <input
                className={inputClassName}
                disabled={pendingAction !== null}
                onChange={(event) =>
                  setPreviewForm((current) => ({
                    ...current,
                    publicAuthorName: event.target.value,
                  }))
                }
                placeholder="对外展示时希望显示的名字"
                type="text"
                value={previewForm.publicAuthorName}
              />
            </Field>

            <Field label="作品形式">
              <input
                className={inputClassName}
                disabled={pendingAction !== null}
                onChange={(event) =>
                  setPreviewForm((current) => ({
                    ...current,
                    formatLabel: event.target.value,
                  }))
                }
                placeholder="例如：小说 / 插画 / 漫画"
                type="text"
                value={previewForm.formatLabel}
              />
            </Field>

            <Field label="公开标签" hint="用逗号、顿号或换行分隔。">
              <input
                className={inputClassName}
                disabled={pendingAction !== null}
                onChange={(event) =>
                  setPreviewForm((current) => ({
                    ...current,
                    publicTagsText: event.target.value,
                  }))
                }
                type="text"
                value={previewForm.publicTagsText}
              />
            </Field>

            <Field label="预告简介">
              <textarea
                className={textareaClassName}
                disabled={pendingAction !== null}
                onChange={(event) =>
                  setPreviewForm((current) => ({
                    ...current,
                    previewSummary: event.target.value,
                  }))
                }
                rows={7}
                value={previewForm.previewSummary}
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-3 pt-4 border-t border-outline-variant">
            <button
              className="px-6 py-2 bg-surface-variant text-on-surface rounded-md font-medium hover:bg-outline-variant transition-colors disabled:opacity-50"
              disabled={pendingAction !== null}
              onClick={() => void handlePreviewSave()}
              type="button"
            >
              {pendingAction === "preview-save" ? "保存中..." : "保存预告草稿"}
            </button>
            <button
              className="px-6 py-2 bg-primary text-on-primary rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              disabled={pendingAction !== null || !flags.previewSubmitOpen}
              onClick={() => void handlePreviewSubmit()}
              type="button"
            >
              {pendingAction === "preview-submit" ? "提交中..." : "提交预告资料"}
            </button>
          </div>

          <p className="text-xs text-on-surface-variant">
            {flags.previewSubmitOpen ? "当前可以提交预告资料。" : "当前只可先保存草稿。"}
          </p>
        </section>

        <section className="space-y-6 bg-surface-container-low/50 border border-outline-variant rounded-xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium text-on-surface">审查说明</h2>
              <p className="text-sm text-on-surface-variant mt-1">这里不对外公开，重点是帮助主催提前了解题材、风险点和需要注意的部分。</p>
            </div>
            <StatusBadge tone={getStatusTone(state.project.draft.reviewStatus)}>
              {projectDraftStatusLabels[state.project.draft.reviewStatus]}
            </StatusBadge>
          </div>

          <div className="space-y-4">
            <Field label="内容概述">
              <textarea
                className={textareaClassName}
                disabled={pendingAction !== null}
                onChange={(event) =>
                  setReviewForm((current) => ({
                    ...current,
                    contentNote: event.target.value,
                  }))
                }
                rows={6}
                value={reviewForm.contentNote}
              />
            </Field>

            <Field label="内容警示">
              <textarea
                className={textareaClassName}
                disabled={pendingAction !== null}
                onChange={(event) =>
                  setReviewForm((current) => ({
                    ...current,
                    contentWarnings: event.target.value,
                  }))
                }
                rows={4}
                value={reviewForm.contentWarnings}
              />
            </Field>

            <Field label="给主催的补充说明">
              <textarea
                className={textareaClassName}
                disabled={pendingAction !== null}
                onChange={(event) =>
                  setReviewForm((current) => ({
                    ...current,
                    reviewNote: event.target.value,
                  }))
                }
                rows={5}
                value={reviewForm.reviewNote}
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-3 pt-4 border-t border-outline-variant">
            <button
              className="px-6 py-2 bg-surface-variant text-on-surface rounded-md font-medium hover:bg-outline-variant transition-colors disabled:opacity-50"
              disabled={pendingAction !== null}
              onClick={() => void handleReviewSave()}
              type="button"
            >
              {pendingAction === "review-save" ? "保存中..." : "保存审查草稿"}
            </button>
            <button
              className="px-6 py-2 bg-primary text-on-primary rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              disabled={pendingAction !== null || !flags.reviewSubmitOpen}
              onClick={() => void handleReviewSubmit()}
              type="button"
            >
              {pendingAction === "review-submit" ? "提交中..." : "提交审查说明"}
            </button>
          </div>

          <p className="text-xs text-on-surface-variant">
            {flags.reviewSubmitOpen ? "当前可以提交审查说明。" : "当前只可先保存草稿。"}
          </p>
        </section>
      </div>

      {notice ? <Notice tone="success">{notice}</Notice> : null}
    </div>
  );
}

const emptyPreviewForm: PreviewFormState = {
  previewTitle: "",
  previewSummary: "",
  publicAuthorName: "",
  formatLabel: "",
  publicTagsText: "",
};

const emptyReviewForm: ReviewFormState = {
  contentNote: "",
  contentWarnings: "",
  reviewNote: "",
};

function buildPreviewForm(draft: PortalProjectDraftDetail): PreviewFormState {
  return {
    previewTitle: draft.previewTitle ?? "",
    previewSummary: draft.previewSummary ?? "",
    publicAuthorName: draft.publicAuthorName ?? "",
    formatLabel: draft.formatLabel ?? "",
    publicTagsText: draft.publicTags.join("，"),
  };
}

function buildReviewForm(draft: PortalProjectDraftDetail): ReviewFormState {
  return {
    contentNote: draft.contentNote ?? "",
    contentWarnings: draft.contentWarnings ?? "",
    reviewNote: draft.reviewNote ?? "",
  };
}

function parseTagsText(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,，、]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function getStatusTone(status: PortalProjectDraftDetail["previewStatus"]): "muted" | "warning" | "success" {
  if (status === "approved") {
    return "success";
  }

  if (status === "changes_requested" || status === "submitted") {
    return "warning";
  }

  return "muted";
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
  tone: "muted" | "warning" | "success";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono font-medium",
        tone === "success" && "bg-tertiary/10 text-tertiary border-tertiary/20",
        tone === "warning" && "bg-primary/10 text-primary border-primary/20",
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
  tone?: "muted" | "warning" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm leading-6",
        tone === "muted" && "border-outline-variant bg-surface-variant/30 text-on-surface-variant",
        tone === "warning" && "border-primary/20 bg-primary/10 text-primary",
        tone === "success" && "border-tertiary/20 bg-tertiary/10 text-tertiary",
      )}
    >
      {children}
    </div>
  );
}
