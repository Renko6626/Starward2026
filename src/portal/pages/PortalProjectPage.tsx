import { workTypeLabels, type WorkType } from "../../shared/works";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Button,
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
  workType: WorkType | "";
  coverUrl: string;
  coverAlt: string;
  workUrl: string;
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

export function PortalProjectPage({ embedded = false, compact = false, onSaved, revision = 0 }: { embedded?: boolean; compact?: boolean; onSaved?: () => Promise<void>; revision?: number } = {}) {
  const navigate = useNavigate();
  const sessionQuery = authClient.useSession();
  const initialized = useRef(false);
  const loadSequence = useRef(0);
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);
  const [state, setState] = useState<ProjectPageState>({ status: "loading" });
  const [previewForm, setPreviewForm] =
    useState<PreviewFormState>(emptyPreviewForm);
  const [reviewForm, setReviewForm] =
    useState<ReviewFormState>(emptyReviewForm);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [noticeError, setNoticeError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionQuery.isPending && !sessionQuery.data) {
      void navigate({ to: "/portal/login" });
      return;
    }

    if (!sessionQuery.data) {
      return;
    }

    const sequence = ++loadSequence.current;
    void loadProjectPage(sequence);
    return () => { if (loadSequence.current === sequence) loadSequence.current += 1; };
  }, [navigate, sessionQuery.data, sessionQuery.isPending, revision]);

  async function loadProjectPage(sequence: number) {
    if (!initialized.current) setState({ status: "loading" });

    try {
      const project = await requestJson<PortalProjectResponse>(
        "/api/portal/project",
      );
      if (sequence !== loadSequence.current) return;
      setRefreshWarning(null);
      applyLoadedProject(project);
    } catch (caught) {
      if (sequence !== loadSequence.current) return;
      if (caught instanceof ApiError && caught.status === 401) {
        void navigate({ to: "/portal/login" });
        return;
      }

      if (initialized.current) {
        setRefreshWarning("作品资料仍保留在页面上，但最新状态暂时无法读取，请稍后刷新。");
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
    if (!initialized.current) {
      setPreviewForm(buildPreviewForm(project.draft));
      setReviewForm(buildReviewForm(project.draft));
      initialized.current = true;
    }
    setState({ status: "ready", project });
  }

  function updateDraft(draft: PortalProjectDraftDetail, section: "preview" | "review") {
    // A saved draft is newer than any metadata request already in flight.
    loadSequence.current += 1;
    if (section === "preview") setPreviewForm(buildPreviewForm(draft));
    else setReviewForm(buildReviewForm(draft));
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
          workType: previewForm.workType || null,
          coverUrl: previewForm.coverUrl,
          coverAlt: previewForm.coverAlt,
          workUrl: previewForm.workUrl,
          previewTitle: previewForm.previewTitle,
          previewSummary: previewForm.previewSummary,
          formatLabel: previewForm.formatLabel,
          publicTags: parseTagsText(previewForm.publicTagsText),
        } satisfies UpdatePortalProjectPreviewInput),
      },
    );

    updateDraft(response.draft, "preview");

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

    updateDraft(response.draft, "review");

    if (!quiet) {
      setNotice(response.message);
    }
  }

  async function refreshSummary() {
    try { await onSaved?.(); }
    catch { setRefreshWarning("操作已完成，但摘要暂未更新，请稍后刷新。"); }
  }

  async function handlePreviewSave() {
    setPendingAction("preview-save");
    setNotice(null);
    setNoticeError(false);
    setRefreshWarning(null);

    try {
      await patchPreview();
      await refreshSummary();
    } catch (caught) {
      setNoticeError(true);
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
    setNoticeError(false);
    setRefreshWarning(null);

    try {
      await patchPreview(true);

      const response = await requestJson<PortalProjectMutationResponse>(
        "/api/portal/project/preview/submit",
        {
          method: "POST",
        },
      );

      updateDraft(response.draft, "preview");
      setNotice(response.message);
      await refreshSummary();
    } catch (caught) {
      setNoticeError(true);
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
    setNoticeError(false);
    setRefreshWarning(null);

    try {
      await patchReview();
      await refreshSummary();
    } catch (caught) {
      setNoticeError(true);
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
    setNoticeError(false);
    setRefreshWarning(null);

    try {
      await patchReview(true);

      const response = await requestJson<PortalProjectMutationResponse>(
        "/api/portal/project/review/submit",
        {
          method: "POST",
        },
      );

      updateDraft(response.draft, "review");
      setNotice(response.message);
      await refreshSummary();
    } catch (caught) {
      setNoticeError(true);
      setNotice(
        caught instanceof Error ? caught.message : "提交审查说明失败。",
      );
    } finally {
      setPendingAction(null);
    }
  }

  if (sessionQuery.isPending || state.status === "loading") return <p>正在读取作品资料。</p>;

  if (state.status === "error") {
    return (
      <div className={embedded ? "space-y-6" : "page-content"}>
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
    <div className={embedded ? "space-y-6" : "page-content"}>
      {!embedded ? <PageHeading
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
      </PageHeading> : null}

      {compact ? <div className="creator-work-summary">
        <div className="workspace-actions"><StatusBadge tone={getStatusTone(state.project.draft.previewStatus)}>预告：{projectDraftStatusLabels[state.project.draft.previewStatus]}</StatusBadge><StatusBadge tone={getStatusTone(state.project.draft.reviewStatus)}>审查：{projectDraftStatusLabels[state.project.draft.reviewStatus]}</StatusBadge></div>
        <h3>{state.project.draft.previewTitle || "作品尚未命名"}</h3>
        <p>{state.project.draft.workType ? workTypeLabels[state.project.draft.workType] : "类型待填写"}</p>
        <p>{state.project.draft.previewSummary || "保存作品简介后会显示在这里。"}</p>
        {state.project.draft.workUrl ? <a className="text-link" href={state.project.draft.workUrl} target="_blank" rel="noreferrer">查看作品</a> : <p className="field-hint">作品链接待填写</p>}
      </div> : <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          label="当前时间段"
          value={
            state.project.participant.currentSegmentCode
              ? `${state.project.participant.currentSegmentCode} ${state.project.participant.currentSegmentName ?? "未命名"}`
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
      </div>}

      {state.project.draft.adminFeedback ? (
        <Notice tone="warning">
          <div className="font-medium">主催反馈</div>
          <div className="mt-2">{state.project.draft.adminFeedback}</div>
          <div className="mt-2 text-sm">
            最近审核时间：{formatDateTime(state.project.draft.reviewedAt)}
          </div>
        </Notice>
      ) : null}

      <Notice>{state.project.draft.publishedAt ? <><span>作品已公开。 </span><Link className="text-link" to="/works/$workId" params={{ workId: state.project.draft.id }}>查看公开作品</Link></> : "作品尚未公开。资料审核通过并由主催发布后，将出现在观测集中。"}</Notice>
      <details className="compact-editor" open={compact ? undefined : true}><summary>编辑作品资料</summary>
      <div className={compact ? "space-y-6" : "grid grid-cols-1 xl:grid-cols-2 gap-6"}>
        <section className={compact ? "space-y-6" : "panel space-y-6"}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium text-on-surface">预告信息</h2>
              <p className="text-base text-on-surface-variant mt-1">
                这里的标题、简介、封面和作品链接会用于公开展示。
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
                disabled={pendingAction !== null || state.project.draft.previewStatus === "approved"}
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
              {embedded ? <a className="text-link" href="#profile">修改署名设置</a> : <Link className="text-link" to="/portal/profile">修改署名设置</Link>}
            </div>

            <Field label="作品类型">
              <select className={inputClassName} disabled={pendingAction !== null || state.project.draft.previewStatus === "approved"}
                value={previewForm.workType} onChange={event => setPreviewForm(current => ({ ...current, workType: event.target.value as WorkType | "" }))}>
                <option value="">请选择作品类型</option>
                {Object.entries(workTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="正式作品链接" hint="填写读者可直接访问的 HTTPS 作品地址，可先留空，发布前补齐。">
              <input className={inputClassName} type="url" maxLength={2048} disabled={pendingAction !== null || state.project.draft.previewStatus === "approved"}
                value={previewForm.workUrl} placeholder="https://…" onChange={event => setPreviewForm(current => ({ ...current, workUrl: event.target.value }))} />
            </Field>
            <Field label="封面地址（选填）" hint="填写可公开访问的 HTTPS 图片地址。不填时以标题和简介展示。">
              <input className={inputClassName} type="url" maxLength={2048} disabled={pendingAction !== null || state.project.draft.previewStatus === "approved"}
                value={previewForm.coverUrl} placeholder="https://…" onChange={event => setPreviewForm(current => ({ ...current, coverUrl: event.target.value }))} />
            </Field>
            <Field label="封面描述（选填）">
              <input className={inputClassName} maxLength={240} disabled={pendingAction !== null || state.project.draft.previewStatus === "approved"}
                value={previewForm.coverAlt} onChange={event => setPreviewForm(current => ({ ...current, coverAlt: event.target.value }))} />
            </Field>

            <Field label="作品形式">
              <input
                className={inputClassName}
                disabled={pendingAction !== null || state.project.draft.previewStatus === "approved"}
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
                disabled={pendingAction !== null || state.project.draft.previewStatus === "approved"}
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
                disabled={pendingAction !== null || state.project.draft.previewStatus === "approved"}
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
            <Button variant="secondary"
              disabled={pendingAction !== null || state.project.draft.previewStatus === "approved"}
              aria-busy={pendingAction === "preview-save"}
              onClick={() => void handlePreviewSave()}
              type="button"
            >
              {pendingAction === "preview-save" ? "保存中..." : "保存预告草稿"}
            </Button>
            <Button
              disabled={pendingAction !== null || !flags.previewSubmitOpen || state.project.draft.previewStatus === "approved"}
              aria-busy={pendingAction === "preview-submit"}
              onClick={() => void handlePreviewSubmit()}
              type="button"
            >
              {pendingAction === "preview-submit"
                ? "提交中..."
                : "提交预告资料"}
            </Button>
          </div>

          <p className="text-sm text-on-surface-variant">
            {state.project.draft.previewStatus === "approved"
              ? "预告已通过审核。如需修改，请联系主催退回；已发布作品需先撤下。"
              : flags.previewSubmitOpen
              ? "当前可以提交预告资料。"
              : "当前只可先保存草稿。"}
          </p>
        </section>

        <section className={compact ? "space-y-6" : "panel space-y-6"}>
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
                disabled={pendingAction !== null || state.project.draft.reviewStatus === "approved"}
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
                disabled={pendingAction !== null || state.project.draft.reviewStatus === "approved"}
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
                disabled={pendingAction !== null || state.project.draft.reviewStatus === "approved"}
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
            <Button variant="secondary"
              disabled={pendingAction !== null || state.project.draft.reviewStatus === "approved"}
              aria-busy={pendingAction === "review-save"}
              onClick={() => void handleReviewSave()}
              type="button"
            >
              {pendingAction === "review-save" ? "保存中..." : "保存审查草稿"}
            </Button>
            <Button
              disabled={pendingAction !== null || !flags.reviewSubmitOpen || state.project.draft.reviewStatus === "approved"}
              aria-busy={pendingAction === "review-submit"}
              onClick={() => void handleReviewSubmit()}
              type="button"
            >
              {pendingAction === "review-submit" ? "提交中..." : "提交审查说明"}
            </Button>
          </div>

          <p className="text-sm text-on-surface-variant">
            {state.project.draft.reviewStatus === "approved"
              ? "审查说明已通过，如需修改请联系主催退回。"
              : flags.reviewSubmitOpen
              ? "当前可以提交审查说明。"
              : "当前只可先保存草稿。"}
          </p>
        </section>
      </div>

      </details>
      {refreshWarning ? <Notice tone="warning">{refreshWarning}</Notice> : null}
      {notice ? <Notice tone={noticeError ? "error" : "success"}>{notice}</Notice> : null}
    </div>
  );
}

const emptyPreviewForm: PreviewFormState = {
  workType: "",
  coverUrl: "",
  coverAlt: "",
  workUrl: "",
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
    workType: draft.workType ?? "",
    coverUrl: draft.coverUrl ?? "",
    coverAlt: draft.coverAlt ?? "",
    workUrl: draft.workUrl ?? "",
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
