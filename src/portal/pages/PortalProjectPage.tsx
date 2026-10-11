import { useSiteTranslation } from "../../i18n/use-site-translation";
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
import { localizeSegmentName } from "../../shared/i18n";

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
  const { t, language, label: systemLabel } = useSiteTranslation();
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
  }, [navigate, sessionQuery.data, sessionQuery.isPending, revision, language]);

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
        setRefreshWarning(t("portal.project.refreshWarning"));
        return;
      }
      setState({
        status: "error",
        forbidden: caught instanceof ApiError && caught.status === 403,
        message:
          caught instanceof Error ? caught.message : t("portal.project.loadError"),
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
    catch { setRefreshWarning(t("portal.common.completedRefresh")); }
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
        caught instanceof Error ? caught.message : t("portal.project.previewSaveError"),
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
        caught instanceof Error ? caught.message : t("portal.project.previewSubmitError"),
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
        caught instanceof Error ? caught.message : t("portal.project.reviewSaveError"),
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
        caught instanceof Error ? caught.message : t("portal.project.reviewSubmitError"),
      );
    } finally {
      setPendingAction(null);
    }
  }

  if (sessionQuery.isPending || state.status === "loading") return <p>{t("portal.project.loading")}</p>;

  if (state.status === "error") {
    return (
      <div className={embedded ? "space-y-6" : "page-content"}>
        <PageHeading title={t("portal.project.title")} />
        {state.forbidden ? (
          <>
            <Notice>{systemLabel(state.message)}</Notice>
            <Link className="text-link" to="/portal/application">
              {t("portal.registration.viewProgress")}</Link>
          </>
        ) : (
          <ReadError message={systemLabel(state.message)} />
        )}
      </div>
    );
  }

  const flags = buildWindowFlagMap(state.project.windows);

  return (
    <div className={embedded ? "space-y-6" : "page-content"}>
      {!embedded ? <PageHeading
        title={<>{t("portal.project.title")}</>}
      >
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={getStatusTone(state.project.draft.previewStatus)}>
            {t("portal.project.previewStatus")}{systemLabel(projectDraftStatusLabels[state.project.draft.previewStatus])}
          </StatusBadge>
          <StatusBadge tone={getStatusTone(state.project.draft.reviewStatus)}>
            {t("portal.project.reviewStatus")}{systemLabel(projectDraftStatusLabels[state.project.draft.reviewStatus])}
          </StatusBadge>
        </div>
      </PageHeading> : null}

      {!compact ? <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          label={t("portal.schedule.current")}
          value={
            state.project.participant.currentSegmentCode
              ? `${state.project.participant.currentSegmentCode} ${localizeSegmentName(state.project.participant.currentSegmentCode, state.project.participant.currentSegmentName, language) || t("portal.common.unnamed")}`
              : t("portal.schedule.notSelected")
          }
        />
        <SummaryCard
          label={t("portal.project.previewWindow")}
          value={getWindowLabel(state.project.windows, "preview_submit_open", language)}
        />
        <SummaryCard
          label={t("portal.project.reviewWindow")}
          value={getWindowLabel(state.project.windows, "review_submit_open", language)}
        />
        <SummaryCard
          label={t("portal.common.lastUpdated")}
          value={formatDateTime(state.project.draft.updatedAt, language)}
        />
      </div> : null}
      {state.project.draft.adminFeedback ? (
        <Notice tone="warning">
          <div className="font-medium">{t("portal.project.hostFeedback")}</div>
          <div className="mt-2">{state.project.draft.adminFeedback}</div>
          <div className="mt-2 text-sm">
            {t("portal.project.lastReviewed")}{formatDateTime(state.project.draft.reviewedAt, language)}
          </div>
        </Notice>
      ) : null}



      <div className={compact ? "space-y-6" : "grid grid-cols-1 xl:grid-cols-2 gap-6"}>
        <ArchiveChapter className="panel space-y-6" enabled={compact} id="preview" number="02" title={t("portal.project.preview")} defaultOpen state={<span className={state.project.draft.previewStatus === "changes_requested" ? "attention" : undefined}>{systemLabel(projectDraftStatusLabels[state.project.draft.previewStatus])}</span>}>
          <div className={compact ? "archive-editor-heading" : "flex items-start justify-between gap-4"}>
            <div>
              <h2 className="text-lg font-medium text-on-surface">{t("portal.project.previewPublic")}</h2>
            </div>
            <StatusBadge
              tone={getStatusTone(state.project.draft.previewStatus)}
            >
              {systemLabel(projectDraftStatusLabels[state.project.draft.previewStatus])}
            </StatusBadge>
          </div>

      {state.project.draft.workUrl ? <a className="text-link" href={state.project.draft.workUrl} target="_blank" rel="noreferrer">{t("portal.project.view")}</a> : null}
      <Notice>{state.project.draft.publishedAt ? <><span>{t("portal.project.published")}</span><Link className="text-link" to="/works/$workId" params={{ workId: state.project.draft.id }}>{t("portal.project.viewPublic")}</Link></> : t("portal.project.contentSubmissionNotice")}</Notice>
          <div className="space-y-4">
            <Field label={t("portal.project.name")}>
              <input
                className={inputClassName}
                disabled={pendingAction !== null}
                onChange={(event) =>
                  setPreviewForm((current) => ({
                    ...current,
                    previewTitle: event.target.value,
                  }))
                }
                placeholder={t("portal.project.namePlaceholder")}
                type="text"
                value={previewForm.previewTitle}
              />
            </Field>

            <div className="space-y-2">
              <p>
                {t("portal.profile.publicCredit")}{state.project.profile?.isAnonymous ? systemLabel('匿名') : state.project.draft.publicAuthorName ?? t("portal.common.notProvided")}
              </p>
              {embedded ? <a className="text-link" href="#profile">{t("portal.profile.editCredit")}</a> : <Link className="text-link" to="/portal/profile">{t("portal.profile.editCredit")}</Link>}
            </div>

            <Field label={t("portal.project.summary")}>
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
                placeholder={t("portal.project.summaryPlaceholder")}
                value={previewForm.previewSummary}
              />
            </Field>

            <div className={compact ? "archive-field-pair" : "space-y-4"}>
            <Field label={t("portal.project.type")}>
              <select className={inputClassName} disabled={pendingAction !== null}
                value={previewForm.workType} onChange={event => setPreviewForm(current => ({ ...current, workType: event.target.value as WorkType | "" }))}>
                <option value="">{t("portal.project.selectType")}</option>
                {Object.entries(workTypeLabels).map(([value, label]) => <option key={value} value={value}>{systemLabel(label)}</option>)}
              </select>
            </Field>
            <Field label={t("portal.project.format")}>
              <input
                className={inputClassName}
                disabled={pendingAction !== null}
                onChange={(event) =>
                  setPreviewForm((current) => ({
                    ...current,
                    formatLabel: event.target.value,
                  }))
                }
                placeholder={t("portal.project.formatPlaceholder")}
                type="text"
                value={previewForm.formatLabel}
              />
            </Field>
            </div>
            <Field label={t("portal.project.coverUrl")}>
              <input className={inputClassName} type="url" maxLength={2048} disabled={pendingAction !== null}
                value={previewForm.coverUrl} placeholder={t("portal.project.coverUrlPlaceholder")} onChange={event => setPreviewForm(current => ({ ...current, coverUrl: event.target.value }))} />
            </Field>
            <Field label={t("portal.project.coverAlt")}>
              <input className={inputClassName} maxLength={240} disabled={pendingAction !== null} placeholder={t("portal.project.coverAltPlaceholder")}
                value={previewForm.coverAlt} onChange={event => setPreviewForm(current => ({ ...current, coverAlt: event.target.value }))} />
            </Field>



            <Field label={t("portal.project.tags")}>
              <input
                className={inputClassName}
                disabled={pendingAction !== null}
                onChange={(event) =>
                  setPreviewForm((current) => ({
                    ...current,
                    publicTagsText: event.target.value,
                  }))
                }
                placeholder={t("portal.project.tagsPlaceholder")}
                type="text"
                value={previewForm.publicTagsText}
              />
            </Field>


          </div>

          <div className="flex flex-wrap gap-3 pt-4 border-t border-outline-variant archive-control-actions">
            {compact ? <span className="archive-control-label" aria-hidden="true">PREVIEW / REVIEW</span> : null}
            <Button appearance={compact ? "industrial" : "default"} variant="secondary"
              disabled={pendingAction !== null}
              aria-busy={pendingAction === "preview-save"}
              onClick={() => void handlePreviewSave()}
              type="button"
            >
              {pendingAction === "preview-save" ? t("portal.common.saving") : t("portal.project.savePreview")}
            </Button>
            {state.project.draft.previewStatus !== "approved" ? <Button appearance={compact ? "industrial" : "default"}
              disabled={pendingAction !== null || !flags.previewSubmitOpen}
              aria-busy={pendingAction === "preview-submit"}
              onClick={() => void handlePreviewSubmit()}
              type="button"
            >
              {pendingAction === "preview-submit"
                ? t("portal.common.submitting")
                : t("portal.project.submitPreview")}
            </Button> : null}
          </div>

          {state.project.draft.previewStatus !== "approved" && !flags.previewSubmitOpen ? <p className="field-hint">{t("portal.project.submissionClosed")}</p> : null}
        </ArchiveChapter>

        <ArchiveChapter className="panel space-y-6" enabled={compact} id="review" number="03" title={t("portal.project.review")} state={<span className={state.project.draft.reviewStatus === "changes_requested" ? "attention" : undefined}>{systemLabel(projectDraftStatusLabels[state.project.draft.reviewStatus])} {t("portal.project.privateSuffix")}</span>}>
          <div className={compact ? "archive-editor-heading" : "flex items-start justify-between gap-4"}>
            <div>
              <h2 className="text-lg font-medium text-on-surface">{t("portal.project.reviewPrivate")}</h2>
            </div>
            <StatusBadge tone={getStatusTone(state.project.draft.reviewStatus)}>
              {systemLabel(projectDraftStatusLabels[state.project.draft.reviewStatus])}
            </StatusBadge>
          </div>

          <div className="space-y-4">
            <Field label={t("portal.project.contentSummary")}>
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
                placeholder={t("portal.project.contentSummaryPlaceholder")}
                value={reviewForm.contentNote}
              />
            </Field>

            <Field label={t("portal.project.warnings")}>
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
                placeholder={t("portal.project.warningsPlaceholder")}
                value={reviewForm.contentWarnings}
              />
            </Field>

            <Field label={t("portal.project.hostNotes")}>
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
                placeholder={t("portal.project.hostNotesPlaceholder")}
                value={reviewForm.reviewNote}
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-3 pt-4 border-t border-outline-variant archive-control-actions">
            {compact ? <span className="archive-control-label" aria-hidden="true">REVIEW / SUBMIT</span> : null}
            <Button appearance={compact ? "industrial" : "default"} variant="secondary"
              disabled={pendingAction !== null}
              aria-busy={pendingAction === "review-save"}
              onClick={() => void handleReviewSave()}
              type="button"
            >
              {pendingAction === "review-save" ? t("portal.common.saving") : t("portal.project.saveReview")}
            </Button>
            {state.project.draft.reviewStatus !== "approved" ? <Button appearance={compact ? "industrial" : "default"}
              disabled={pendingAction !== null || !flags.reviewSubmitOpen}
              aria-busy={pendingAction === "review-submit"}
              onClick={() => void handleReviewSubmit()}
              type="button"
            >
              {pendingAction === "review-submit" ? t("portal.common.submitting") : t("portal.project.submitReview")}
            </Button> : null}
          </div>

          {state.project.draft.reviewStatus !== "approved" && !flags.reviewSubmitOpen ? <p className="field-hint">{t("portal.project.submissionClosed")}</p> : null}
        </ArchiveChapter>
      </div>


      {refreshWarning ? <Notice tone="warning">{systemLabel(refreshWarning)}</Notice> : null}
      {notice ? <Notice tone={noticeError ? "error" : "success"}>{systemLabel(notice)}</Notice> : null}
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
