import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SectionCard } from "../../app/components/SectionCard";
import { StatusBadge } from "../../app/components/StatusBadge";
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
    setState({
      status: "ready",
      project,
    });
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

    return response.draft;
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

    return response.draft;
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

      const response = await requestJson<PortalProjectMutationResponse>(
        "/api/portal/project/preview/submit",
        {
          method: "POST",
        },
      );

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

      const response = await requestJson<PortalProjectMutationResponse>(
        "/api/portal/project/review/submit",
        {
          method: "POST",
        },
      );

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
      <div className="page-stack">
        <div className="page-heading">
          <StatusBadge label="门户 / 资料补录" />
          <h1>预告信息与审查说明</h1>
          <p>正在读取当前作品资料状态。</p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="page-stack">
        <div className="page-heading">
          <StatusBadge label="门户 / 资料补录" />
          <h1>预告信息与审查说明</h1>
          <p>{state.message}</p>
        </div>
      </div>
    );
  }

  const flags = buildWindowFlagMap(state.project.windows);

  return (
    <div className="page-stack">
      <div className="page-heading">
        <StatusBadge label="门户 / 资料补录" />
        <h1>预告信息与审查说明</h1>
        <p>
          {state.project.participant.displayName}，这里是你后续反复回来的资料工作台。
          先把可公开预告和给主催看的审查说明分别补全，再在开放窗口内提交。
        </p>
      </div>

      <div className="route-grid">
        <div className="mini-card">
          <strong>当前时间段</strong>
          <p>
            {state.project.participant.currentSegmentCode
              ? `${state.project.participant.currentSegmentCode} · ${state.project.participant.currentSegmentName ?? "未命名"}`
              : "尚未认领"}
          </p>
        </div>
        <div className="mini-card">
          <strong>预告状态</strong>
          <p>{projectDraftStatusLabels[state.project.draft.previewStatus]}</p>
        </div>
        <div className="mini-card">
          <strong>审查状态</strong>
          <p>{projectDraftStatusLabels[state.project.draft.reviewStatus]}</p>
        </div>
        <div className="mini-card">
          <strong>最近更新时间</strong>
          <p>{formatDateTime(state.project.draft.updatedAt)}</p>
        </div>
      </div>

      <SectionCard
        eyebrow="当前阶段"
        title="我现在能做什么"
        description="保存草稿始终可用；真正提交给主催要看窗口是否开放。"
        accent="blue"
      >
        <div className="detail-grid">
          <div className="mini-card mini-card--compact">
            <strong>预告资料提交</strong>
            <p>{flags.previewSubmitOpen ? "已开放" : "未开放"}</p>
          </div>
          <div className="mini-card mini-card--compact">
            <strong>审查说明提交</strong>
            <p>{flags.reviewSubmitOpen ? "已开放" : "未开放"}</p>
          </div>
          <div className="mini-card mini-card--compact">
            <strong>预告上次提交</strong>
            <p>{formatDateTime(state.project.draft.previewSubmittedAt)}</p>
          </div>
          <div className="mini-card mini-card--compact">
            <strong>审查上次提交</strong>
            <p>{formatDateTime(state.project.draft.reviewSubmittedAt)}</p>
          </div>
        </div>
      </SectionCard>

      {state.project.draft.adminFeedback ? (
        <SectionCard
          eyebrow="主催反馈"
          title="这一条需要优先看"
          description="如果资料被要求修改，请先根据这里的反馈调整，再重新提交。"
          accent="amber"
        >
          <div className="mini-card mini-card--compact">
            <strong>反馈内容</strong>
            <p>{state.project.draft.adminFeedback}</p>
            <p>最近审核时间：{formatDateTime(state.project.draft.reviewedAt)}</p>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        eyebrow="预告信息"
        title="给公开页面和预热使用的内容"
        description="这里填的是之后可能对外展示的标题、简介和署名。"
      >
        <div className="detail-grid">
          <div className="mini-card mini-card--compact">
            <StatusBadge
              label={projectDraftStatusLabels[state.project.draft.previewStatus]}
              tone={getStatusTone(state.project.draft.previewStatus)}
            />
            <p>公开作者名：{state.project.draft.publicAuthorName ?? "未填写"}</p>
          </div>
          <div className="mini-card mini-card--compact">
            <strong>提交窗口</strong>
            <p>{flags.previewSubmitOpen ? "当前可以提交预告资料。" : "当前只可先保存草稿。"}</p>
          </div>
        </div>

        <div className="grid-two">
          <label className="field">
            <span>预告标题</span>
            <input
              disabled={pendingAction !== null}
              onChange={(event) =>
                setPreviewForm((current) => ({
                  ...current,
                  previewTitle: event.target.value,
                }))
              }
              placeholder="例如：边界面浮上试验"
              value={previewForm.previewTitle}
            />
          </label>

          <label className="field">
            <span>公开作者名</span>
            <input
              disabled={pendingAction !== null}
              onChange={(event) =>
                setPreviewForm((current) => ({
                  ...current,
                  publicAuthorName: event.target.value,
                }))
              }
              placeholder="对外展示时希望显示的名字"
              value={previewForm.publicAuthorName}
            />
          </label>
        </div>

        <div className="grid-two">
          <label className="field">
            <span>作品形式</span>
            <input
              disabled={pendingAction !== null}
              onChange={(event) =>
                setPreviewForm((current) => ({
                  ...current,
                  formatLabel: event.target.value,
                }))
              }
              placeholder="例如：小说 / 插画 / 漫画"
              value={previewForm.formatLabel}
            />
          </label>

          <label className="field">
            <span>公开标签</span>
            <input
              disabled={pendingAction !== null}
              onChange={(event) =>
                setPreviewForm((current) => ({
                  ...current,
                  publicTagsText: event.target.value,
                }))
              }
              placeholder="用逗号、顿号或换行分隔"
              value={previewForm.publicTagsText}
            />
          </label>
        </div>

        <label className="field">
          <span>预告简介</span>
          <textarea
            disabled={pendingAction !== null}
            onChange={(event) =>
              setPreviewForm((current) => ({
                ...current,
                previewSummary: event.target.value,
              }))
            }
            rows={6}
            value={previewForm.previewSummary}
          />
        </label>

        <div className="action-row">
          <button
            className="button button--secondary"
            disabled={pendingAction !== null}
            onClick={() => void handlePreviewSave()}
            type="button"
          >
            {pendingAction === "preview-save" ? "保存中" : "保存预告草稿"}
          </button>
          <button
            className="button button--primary"
            disabled={pendingAction !== null || !flags.previewSubmitOpen}
            onClick={() => void handlePreviewSubmit()}
            type="button"
          >
            {pendingAction === "preview-submit" ? "提交中" : "提交预告资料"}
          </button>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="审查说明"
        title="给主催看的内容概述与警示"
        description="这里不对外公开，重点是帮助主催提前了解题材、风险点和需要注意的部分。"
      >
        <div className="detail-grid">
          <div className="mini-card mini-card--compact">
            <StatusBadge
              label={projectDraftStatusLabels[state.project.draft.reviewStatus]}
              tone={getStatusTone(state.project.draft.reviewStatus)}
            />
            <p>最近审核时间：{formatDateTime(state.project.draft.reviewedAt)}</p>
          </div>
          <div className="mini-card mini-card--compact">
            <strong>提交窗口</strong>
            <p>{flags.reviewSubmitOpen ? "当前可以提交审查说明。" : "当前只可先保存草稿。"}</p>
          </div>
        </div>

        <label className="field">
          <span>内容概述</span>
          <textarea
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
        </label>

        <label className="field">
          <span>内容警示</span>
          <textarea
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
        </label>

        <label className="field">
          <span>给主催的补充说明</span>
          <textarea
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
        </label>

        <div className="action-row">
          <button
            className="button button--secondary"
            disabled={pendingAction !== null}
            onClick={() => void handleReviewSave()}
            type="button"
          >
            {pendingAction === "review-save" ? "保存中" : "保存审查草稿"}
          </button>
          <button
            className="button button--primary"
            disabled={pendingAction !== null || !flags.reviewSubmitOpen}
            onClick={() => void handleReviewSubmit()}
            type="button"
          >
            {pendingAction === "review-submit" ? "提交中" : "提交审查说明"}
          </button>
        </div>
      </SectionCard>

      {notice ? <p className="inline-message">{notice}</p> : null}
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

function getStatusTone(status: PortalProjectDraftDetail["previewStatus"]): "info" | "warn" | "success" {
  if (status === "approved") {
    return "success";
  }

  if (status === "changes_requested") {
    return "warn";
  }

  return "info";
}
