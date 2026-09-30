import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Field,
  Notice,
  PageHeading,
  StatusBadge,
  SummaryCard,
  ReadError,
} from "../../app/components/ui";
import { ApiError, requestJson } from "../../app/lib/api";
import { formatDateTime } from "../../app/lib/format";
import type {
  PortalProjectDraftDetail,
  PortalProjectMutationResponse,
  PortalProjectResponse,
  UpdatePortalProjectPreviewInput,
  UpdatePortalProjectReviewInput,
} from "../../shared/portal";
import { projectDraftStatusLabels } from "../../shared/portal";
import { buildWindowFlagMap, getWindowLabel } from "../../shared/windows";
import { authClient } from "../lib/auth-client";

type ProjectPageState =
  | { status: "loading" }
  | { status: "ready"; project: PortalProjectResponse }
  | { status: "error"; message: string; forbidden: boolean };

type PreviewFormState = {
  previewTitle: string;
  previewSummary: string;
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

const inputClassName = "field-input";

const textareaClassName = "field-input min-h-32 resize-y";

export function PortalProjectPage() {
  const navigate = useNavigate();
  const sessionQuery = authClient.useSession();
  const [state, setState] = useState<ProjectPageState>({ status: "loading" });
  const [previewForm, setPreviewForm] =
    useState<PreviewFormState>(emptyPreviewForm);
  const [reviewForm, setReviewForm] =
    useState<ReviewFormState>(emptyReviewForm);
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
      const project = await requestJson<PortalProjectResponse>(
        "/api/portal/project",
      );
      applyLoadedProject(project);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        void navigate({ to: "/portal/login" });
        return;
      }

      setState({
        status: "error",
        forbidden: caught instanceof ApiError && caught.status === 403,
        message:
          caught instanceof Error ? caught.message : "无法读取作品资料。",
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
    const response = await requestJson<PortalProjectMutationResponse>(
      "/api/portal/project/preview",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          previewTitle: previewForm.previewTitle,
          previewSummary: previewForm.previewSummary,
          formatLabel: previewForm.formatLabel,
          publicTags: parseTagsText(previewForm.publicTagsText),
        } satisfies UpdatePortalProjectPreviewInput),
      },
    );

    updateDraft(response.draft);

    if (!quiet) {
      setNotice(response.message);
    }
  }

  async function patchReview(quiet = false) {
    const response = await requestJson<PortalProjectMutationResponse>(
      "/api/portal/project/review",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          contentNote: reviewForm.contentNote,
          contentWarnings: reviewForm.contentWarnings,
          reviewNote: reviewForm.reviewNote,
        } satisfies UpdatePortalProjectReviewInput),
      },
    );

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
      setNotice(
        caught instanceof Error ? caught.message : "保存预告信息失败。",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handlePreviewSubmit() {
    setPendingAction("preview-submit");
    setNotice(null);

    try {
      await patchPreview(true);

      const response = await requestJson<PortalProjectMutationResponse>(
        "/api/portal/project/preview/submit",
        {
          method: "POST",
        },
      );

      updateDraft(response.draft);
      setNotice(response.message);
    } catch (caught) {
      setNotice(
        caught instanceof Error ? caught.message : "提交预告资料失败。",
      );
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
      setNotice(
        caught instanceof Error ? caught.message : "保存审查说明失败。",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleReviewSubmit() {
    setPendingAction("review-submit");
    setNotice(null);

    try {
      await patchReview(true);

      const response = await requestJson<PortalProjectMutationResponse>(
        "/api/portal/project/review/submit",
        {
          method: "POST",
        },
      );

      updateDraft(response.draft);
      setNotice(response.message);
    } catch (caught) {
      setNotice(
        caught instanceof Error ? caught.message : "提交审查说明失败。",
      );
    } finally {
      setPendingAction(null);
    }
  }

  if (sessionQuery.isPending || state.status === "loading") {
    return (
      <PageHeading
        title={<>作品资料</>}
        description={<>正在读取当前作品资料状态。</>}
      ></PageHeading>
    );
  }

  if (state.status === "error") {
    return (
      <div className="page-content">
        <PageHeading title="作品资料" />
        {state.forbidden ? (
          <>
            <Notice>{state.message}</Notice>
            <Link className="text-link" to="/portal/application">
              查看报名进度
            </Link>
          </>
        ) : (
          <ReadError message={state.message} />
        )}
      </div>
    );
  }

  const flags = buildWindowFlagMap(state.project.windows);

  return (
    <div className="page-content">
      <PageHeading
        title={<>作品资料</>}
        description={
          <>
            填写公开预告和给主催的审查说明，再在开放窗口内提交。
          </>
        }
      >
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={getStatusTone(state.project.draft.previewStatus)}>
            预告：{projectDraftStatusLabels[state.project.draft.previewStatus]}
          </StatusBadge>
          <StatusBadge tone={getStatusTone(state.project.draft.reviewStatus)}>
            审查：{projectDraftStatusLabels[state.project.draft.reviewStatus]}
          </StatusBadge>
        </div>
      </PageHeading>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          label="当前时间段"
          value={
            state.project.participant.currentSegmentCode
              ? `${state.project.participant.currentSegmentCode} · ${state.project.participant.currentSegmentName ?? "未命名"}`
              : "尚未认领"
          }
        />
        <SummaryCard
          label="预告提交"
          value={getWindowLabel(state.project.windows, "preview_submit_open")}
        />
        <SummaryCard
          label="审查提交"
          value={getWindowLabel(state.project.windows, "review_submit_open")}
        />
        <SummaryCard
          label="最近更新"
          value={formatDateTime(state.project.draft.updatedAt)}
        />
      </div>

      {state.project.draft.adminFeedback ? (
        <Notice tone="warning">
          <div className="font-medium">主催反馈</div>
          <div className="mt-2">{state.project.draft.adminFeedback}</div>
          <div className="mt-2 text-sm">
            最近审核时间：{formatDateTime(state.project.draft.reviewedAt)}
          </div>
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="panel space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium text-on-surface">预告信息</h2>
              <p className="text-base text-on-surface-variant mt-1">
                这里填写的是之后可能对外展示的标题、简介和标签。
              </p>
            </div>
            <StatusBadge
              tone={getStatusTone(state.project.draft.previewStatus)}
            >
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

            <div className="space-y-2">
              <p>
                对外署名：{state.project.draft.publicAuthorName ?? "未填写"}
              </p>
              <Link className="text-link" to="/portal/profile">
                修改署名设置
              </Link>
            </div>

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
              aria-busy={pendingAction === "preview-save"}
              onClick={() => void handlePreviewSave()}
              type="button"
            >
              {pendingAction === "preview-save" ? "保存中..." : "保存预告草稿"}
            </button>
            <button
              className="button button--primary"
              disabled={pendingAction !== null || !flags.previewSubmitOpen}
              aria-busy={pendingAction === "preview-submit"}
              onClick={() => void handlePreviewSubmit()}
              type="button"
            >
              {pendingAction === "preview-submit"
                ? "提交中..."
                : "提交预告资料"}
            </button>
          </div>

          <p className="text-sm text-on-surface-variant">
            {flags.previewSubmitOpen
              ? "当前可以提交预告资料。"
              : "当前只可先保存草稿。"}
          </p>
        </section>

        <section className="panel space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium text-on-surface">审查说明</h2>
              <p className="text-base text-on-surface-variant mt-1">
                这里不对外公开，重点是帮助主催提前了解题材、风险点和需要注意的部分。
              </p>
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
              aria-busy={pendingAction === "review-save"}
              onClick={() => void handleReviewSave()}
              type="button"
            >
              {pendingAction === "review-save" ? "保存中..." : "保存审查草稿"}
            </button>
            <button
              className="button button--primary"
              disabled={pendingAction !== null || !flags.reviewSubmitOpen}
              aria-busy={pendingAction === "review-submit"}
              onClick={() => void handleReviewSubmit()}
              type="button"
            >
              {pendingAction === "review-submit" ? "提交中..." : "提交审查说明"}
            </button>
          </div>

          <p className="text-sm text-on-surface-variant">
            {flags.reviewSubmitOpen
              ? "当前可以提交审查说明。"
              : "当前只可先保存草稿。"}
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

function getStatusTone(
  status: PortalProjectDraftDetail["previewStatus"],
): "muted" | "warning" | "success" {
  if (status === "approved") {
    return "success";
  }

  if (status === "changes_requested" || status === "submitted") {
    return "warning";
  }

  return "muted";
}
