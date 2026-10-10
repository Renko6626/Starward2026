import { ArchiveChapter } from "../components/ArchiveChapter";
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
    catch { setRefreshWarning("操作已完成，页面暂未更新，请稍后刷新。"); }
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
      >
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={getStatusTone(state.project.draft.previewStatus)}>
            作品预告：{projectDraftStatusLabels[state.project.draft.previewStatus]}
          </StatusBadge>
          <StatusBadge tone={getStatusTone(state.project.draft.reviewStatus)}>
            审查说明：{projectDraftStatusLabels[state.project.draft.reviewStatus]}
          </StatusBadge>
        </div>
      </PageHeading> : null}

      {!compact ? <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          label="当前发布时点"
          value={
            state.project.participant.currentSegmentCode
              ? `${state.project.participant.currentSegmentCode} ${state.project.participant.currentSegmentName ?? "未命名"}`
              : "尚未选择"
          }
        />
        <SummaryCard
          label="预告提交时间"
          value={getWindowLabel(state.project.windows, "preview_submit_open")}
        />
        <SummaryCard
          label="说明提交时间"
          value={getWindowLabel(state.project.windows, "review_submit_open")}
        />
        <SummaryCard
          label="最近更新"
          value={formatDateTime(state.project.draft.updatedAt)}
        />
      </div> : null}
      {state.project.draft.adminFeedback ? (
        <Notice tone="warning">
          <div className="font-medium">主催反馈</div>
          <div className="mt-2">{state.project.draft.adminFeedback}</div>
          <div className="mt-2 text-sm">
            最近审核时间：{formatDateTime(state.project.draft.reviewedAt)}
          </div>
        </Notice>
      ) : null}



      <div className={compact ? "space-y-6" : "grid grid-cols-1 xl:grid-cols-2 gap-6"}>
        <ArchiveChapter className="panel space-y-6" enabled={compact} id="preview" number="02" title="作品预告" defaultOpen state={<span className={state.project.draft.previewStatus === "changes_requested" ? "attention" : undefined}>{projectDraftStatusLabels[state.project.draft.previewStatus]}</span>}>
          <div className={compact ? "archive-editor-heading" : "flex items-start justify-between gap-4"}>
            <div>
              <h2 className="text-lg font-medium text-on-surface">作品预告（公开）</h2>
            </div>
            <StatusBadge
              tone={getStatusTone(state.project.draft.previewStatus)}
            >
              {projectDraftStatusLabels[state.project.draft.previewStatus]}
            </StatusBadge>
          </div>

      {state.project.draft.workUrl ? <a className="text-link" href={state.project.draft.workUrl} target="_blank" rel="noreferrer">查看作品</a> : null}
      <Notice>{state.project.draft.publishedAt ? <><span>作品已公开。 </span><Link className="text-link" to="/works/$workId" params={{ workId: state.project.draft.id }}>查看公开作品</Link></> : "正式作品内容提交方式另行通知。"}</Notice>
          <div className="space-y-4">
            <Field label="作品标题">
              <input
                className={inputClassName}
                disabled={pendingAction !== null}
                onChange={(event) =>
                  setPreviewForm((current) => ({
                    ...current,
                    previewTitle: event.target.value,
                  }))
                }
                placeholder="填写作品标题"
                type="text"
                value={previewForm.previewTitle}
              />
            </Field>

            <div className="space-y-2">
              <p>
                公开署名：{state.project.draft.publicAuthorName ?? "未填写"}
              </p>
              {embedded ? <a className="text-link" href="#profile">修改署名设置</a> : <Link className="text-link" to="/portal/profile">修改署名设置</Link>}
            </div>

            <Field label="作品简介">
              <textarea
                className={textareaClassName}
                disabled={pendingAction !== null}
                onChange={(event) =>
                  setPreviewForm((current) => ({
                    ...current,
                    previewSummary: event.target.value,
                  }))
                }
                rows={compact ? 3 : 7}
                placeholder="填写供读者查看的作品简介，审核通过后可公开展示；请勿填写私人联系方式。"
                value={previewForm.previewSummary}
              />
            </Field>

            <div className={compact ? "archive-field-pair" : "space-y-4"}>
            <Field label="作品类型">
              <select className={inputClassName} disabled={pendingAction !== null}
                value={previewForm.workType} onChange={event => setPreviewForm(current => ({ ...current, workType: event.target.value as WorkType | "" }))}>
                <option value="">请选择作品类型</option>
                {Object.entries(workTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
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
                placeholder="例如：短篇小说、组图、手书视频"
                type="text"
                value={previewForm.formatLabel}
              />
            </Field>
            </div>
            <Field label="封面地址（选填）">
              <input className={inputClassName} type="url" maxLength={2048} disabled={pendingAction !== null}
                value={previewForm.coverUrl} placeholder="公开可访问的 HTTPS 图片地址，可不填" onChange={event => setPreviewForm(current => ({ ...current, coverUrl: event.target.value }))} />
            </Field>
            <Field label="封面描述（选填）">
              <input className={inputClassName} maxLength={240} disabled={pendingAction !== null} placeholder="简要描述封面画面，可不填"
                value={previewForm.coverAlt} onChange={event => setPreviewForm(current => ({ ...current, coverAlt: event.target.value }))} />
            </Field>



            <Field label="作品标签（选填）">
              <input
                className={inputClassName}
                disabled={pendingAction !== null}
                onChange={(event) =>
                  setPreviewForm((current) => ({
                    ...current,
                    publicTagsText: event.target.value,
                  }))
                }
                placeholder="用逗号、顿号或换行分隔，可不填"
                type="text"
                value={previewForm.publicTagsText}
              />
            </Field>


          </div>

          <div className="flex flex-wrap gap-3 pt-4 border-t border-outline-variant">
            <Button variant="secondary"
              disabled={pendingAction !== null}
              aria-busy={pendingAction === "preview-save"}
              onClick={() => void handlePreviewSave()}
              type="button"
            >
              {pendingAction === "preview-save" ? "保存中…" : "保存作品预告"}
            </Button>
            {state.project.draft.previewStatus !== "approved" ? <Button
              disabled={pendingAction !== null || !flags.previewSubmitOpen}
              aria-busy={pendingAction === "preview-submit"}
              onClick={() => void handlePreviewSubmit()}
              type="button"
            >
              {pendingAction === "preview-submit"
                ? "提交中…"
                : "提交预告审核"}
            </Button> : null}
          </div>

          {state.project.draft.previewStatus !== "approved" && !flags.previewSubmitOpen ? <p className="field-hint">提交尚未开放</p> : null}
        </ArchiveChapter>

        <ArchiveChapter className="panel space-y-6" enabled={compact} id="review" number="03" title="审查说明" state={<span className={state.project.draft.reviewStatus === "changes_requested" ? "attention" : undefined}>{projectDraftStatusLabels[state.project.draft.reviewStatus]} / 不公开</span>}>
          <div className={compact ? "archive-editor-heading" : "flex items-start justify-between gap-4"}>
            <div>
              <h2 className="text-lg font-medium text-on-surface">审查说明（不公开）</h2>
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
                rows={compact ? 3 : 6}
                placeholder="作品完成后，简要说明内容供主催核对。"
                value={reviewForm.contentNote}
              />
            </Field>

            <Field label="内容提醒">
              <textarea
                className={textareaClassName}
                disabled={pendingAction !== null}
                onChange={(event) =>
                  setReviewForm((current) => ({
                    ...current,
                    contentWarnings: event.target.value,
                  }))
                }
                rows={compact ? 2 : 4}
                placeholder="写明需要提前提醒的情节；没有则填“无”。"
                value={reviewForm.contentWarnings}
              />
            </Field>

            <Field label="给主催的补充说明（选填）">
              <textarea
                className={textareaClassName}
                disabled={pendingAction !== null}
                onChange={(event) =>
                  setReviewForm((current) => ({
                    ...current,
                    reviewNote: event.target.value,
                  }))
                }
                rows={compact ? 2 : 5}
                placeholder="其他需要告知主催的事项，可不填"
                value={reviewForm.reviewNote}
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-3 pt-4 border-t border-outline-variant">
            <Button variant="secondary"
              disabled={pendingAction !== null}
              aria-busy={pendingAction === "review-save"}
              onClick={() => void handleReviewSave()}
              type="button"
            >
              {pendingAction === "review-save" ? "保存中…" : "保存审查说明"}
            </Button>
            {state.project.draft.reviewStatus !== "approved" ? <Button
              disabled={pendingAction !== null || !flags.reviewSubmitOpen}
              aria-busy={pendingAction === "review-submit"}
              onClick={() => void handleReviewSubmit()}
              type="button"
            >
              {pendingAction === "review-submit" ? "提交中…" : "提交说明审核"}
            </Button> : null}
          </div>

          {state.project.draft.reviewStatus !== "approved" && !flags.reviewSubmitOpen ? <p className="field-hint">提交尚未开放</p> : null}
        </ArchiveChapter>
      </div>


      {refreshWarning ? <Notice tone="warning">{refreshWarning}</Notice> : null}
      {notice ? <Notice tone={noticeError ? "error" : "success"}>{notice}</Notice> : null}
    </div>
  );
}

const emptyPreviewForm: PreviewFormState = {
  workType: "",
  coverUrl: "",
  coverAlt: "",
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
