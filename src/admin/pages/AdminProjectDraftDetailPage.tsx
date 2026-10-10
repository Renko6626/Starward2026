import { WorkPresentation } from "../../app/components/WorkPresentation";
import { getWorkPublicationIssues } from "../../shared/works";
import { eventWindowStateLabels } from "../../shared/windows";
import { Link, getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  XCircle,
} from "../../app/components/icons";
import {
  ReadError,
  DetailBlock,
  DetailItem,
  Field as FormField,
  PageHeading,
  Notice as SidebarNotice,
} from "../../app/components/ui";
import { requestJson } from "../../app/lib/api";
import { cn } from "../../app/lib/cn";
import { formatDateTime } from "../../app/lib/format";
import {
  adminParticipantStatusLabels,
  adminProjectDraftStatusLabels,
  type AdminProjectDraftDetailResponse,
  type AdminProjectDraftMutationResponse,
  type UpdateProjectDraftInput,
} from "../../shared/admin";

const draftRouteApi = getRouteApi("/admin/project-drafts/$draftId");

const initialForm: UpdateProjectDraftInput = {
  previewStatus: "not_started",
  reviewStatus: "not_started",
  adminFeedback: "",
};

type DetailState =
  | { status: "loading" }
  | { status: "ready"; payload: AdminProjectDraftDetailResponse }
  | { status: "error"; message: string };

export function AdminProjectDraftDetailPage() {
  const { draftId } = draftRouteApi.useParams();
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [form, setForm] = useState<UpdateProjectDraftInput>(initialForm);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadDetail();
  }, [draftId]);

  async function loadDetail() {
    setState({ status: "loading" });

    try {
      const payload = await requestJson<AdminProjectDraftDetailResponse>(
        `/api/admin/project-drafts/${draftId}`,
      );
      setState({ status: "ready", payload });
      setForm({
        previewStatus: payload.draft.previewStatus,
        reviewStatus: payload.draft.reviewStatus,
        adminFeedback: payload.draft.adminFeedback ?? "",
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "无法读取资料详情。",
      });
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const payload = await requestJson<AdminProjectDraftMutationResponse>(
        `/api/admin/project-drafts/${draftId}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            previewStatus: form.previewStatus,
            reviewStatus: form.reviewStatus,
            adminFeedback: form.adminFeedback?.trim() || null,
          } satisfies UpdateProjectDraftInput),
        },
      );

      setState(current => current.status === "ready" ? {
        status: "ready", payload: { ...current.payload, draft: payload.draft },
      } : current);
      setForm({
        previewStatus: payload.draft.previewStatus,
        reviewStatus: payload.draft.reviewStatus,
        adminFeedback: payload.draft.adminFeedback ?? "",
      });
      setMessage(payload.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存资料审核失败。");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublication(publish: boolean) {
    setSaving(true);
    setMessage(null);
    try {
      const result = await requestJson<AdminProjectDraftMutationResponse>(`/api/admin/project-drafts/${draftId}/${publish ? "publish" : "unpublish"}`, { method: "POST" });
      setState(current => current.status === "ready" ? { status: "ready", payload: { ...current.payload, draft: result.draft } } : current);
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "作品发布操作失败。");
    } finally { setSaving(false); }
  }

  if (state.status === "loading") {
    return <DraftDetailShell description="正在读取资料详情。" />;
  }

  if (state.status === "error") {
    return (
      <div className="page-content">
        <PageHeading title="作品审核详情" />
        <ReadError message={state.message} />
      </div>
    );
  }

  const draft = state.payload.draft;
  const publicationIssues = getWorkPublicationIssues(draft);

  return (
    <div className="page-content">
      <div className="mb-4">
        <Link
          className="text-base font-mono text-on-surface-variant hover:text-primary transition-colors flex min-h-11 items-center gap-2 mb-4"
          to="/admin/project-drafts"
        >
          <ArrowRight className="w-4 h-4 rotate-180" /> 返回草案库
        </Link>
        <PageHeading
          title={<>作品审核详情</>}
          description={<>ID: {draft.id}</>}
        >
          <div className="flex flex-wrap gap-2 justify-end">
            <DraftStatusBadge status={draft.previewStatus} label="预告" />
            <DraftStatusBadge status={draft.reviewStatus} label="审查" />
          </div>
        </PageHeading>
      </div>

      {previewOpen && <section className="panel mb-6" id="public-work-preview" aria-label="公开作品预览"><p className="eyebrow">公开页面预览</p><div className="work-admin-preview"><WorkPresentation work={draft} /></div></section>}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <section className="panel space-y-6">
            <h2 className="text-base font-mono text-on-surface-variant uppercase border-b border-outline-variant pb-2">
              参与者与关联信息
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-base">
              <DetailItem label="参与者" value={draft.participantName} />
              <DetailItem
                label="联系邮箱"
                value={draft.participantInviteEmail ?? "未设置登录邮箱"}
              />
              <DetailItem
                label="参与状态"
                value={adminParticipantStatusLabels[draft.participantStatus]}
              />
              <DetailItem
                label="联系方式备注"
                value={draft.participantContactHandle ?? "未填写"}
              />
              <DetailItem
                label="当前时间段"
                value={
                  draft.segmentCode
                    ? `${draft.segmentCode} · ${draft.segmentName ?? "未命名"}`
                    : "暂无"
                }
              />
              <DetailItem
                label="最近更新"
                value={formatDateTime(draft.updatedAt)}
              />
            </div>
            <Link
              className="inline-flex min-h-10 items-center justify-center gap-2 px-4 py-2 bg-surface-variant border border-outline-variant rounded-md hover:bg-surface-bright transition-colors font-medium"
              params={{ participantId: draft.participantId }}
              to="/admin/participants/$participantId"
            >
              查看参与者详情
            </Link>
          </section>

          <section className="panel space-y-6">
            <h2 className="text-base font-mono text-on-surface-variant uppercase border-b border-outline-variant pb-2">
              预告信息
            </h2>
            <div className="space-y-4">
              <DetailBlock
                title="标题"
                value={draft.previewTitle ?? "未填写"}
              />
              <DetailBlock
                title="对外署名"
                value={draft.publicAuthorName ?? "未填写"}
              />
              <DetailBlock
                title="作品形式"
                value={draft.formatLabel ?? "未填写"}
              />
              <DetailBlock
                title="标签"
                value={
                  draft.publicTags.length > 0
                    ? draft.publicTags.join(" / ")
                    : "未填写"
                }
              />
              <DetailBlock
                title="提交时间"
                value={formatDateTime(draft.previewSubmittedAt)}
              />
              <DetailBlock
                title="预告简介"
                value={draft.previewSummary ?? "未填写"}
              />
            </div>
          </section>

          <section className="panel space-y-6">
            <h2 className="text-base font-mono text-on-surface-variant uppercase border-b border-outline-variant pb-2">
              审查说明
            </h2>
            <div className="space-y-4">
              <DetailBlock
                title="提交时间"
                value={formatDateTime(draft.reviewSubmittedAt)}
              />
              <DetailBlock
                title="内容概述"
                value={draft.contentNote ?? "未填写"}
              />
              <DetailBlock
                title="内容提醒"
                value={draft.contentWarnings ?? "未填写"}
              />
              <DetailBlock
                title="补充说明"
                value={draft.reviewNote ?? "未填写"}
              />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="panel space-y-4">
            <h2 className="panel-title">公开展示</h2>
            <p>{draft.publishedAt ? `已发布 · ${formatDateTime(draft.publishedAt)}` : "尚未发布"}</p>
            <p className="text-sm text-on-surface-variant">新增发布窗口：{eventWindowStateLabels[state.payload.publicationWindow.state]}</p>
            {!draft.publishedAt && publicationIssues.length > 0 && <ul className="publication-issues">{publicationIssues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
            <button className="button button--secondary w-full" type="button" aria-expanded={previewOpen} aria-controls="public-work-preview" onClick={() => setPreviewOpen(open => !open)}>{previewOpen ? "收起公开预览" : "预览公开效果"}</button>
            <button className="button button--primary w-full" type="button" disabled={saving || (!draft.publishedAt && (publicationIssues.length > 0 || !state.payload.publicationWindow.isOpen))}
              onClick={() => void handlePublication(!draft.publishedAt)}>{saving ? "处理中…" : draft.publishedAt ? "撤下作品" : "发布到观测集"}</button>
            {draft.publishedAt && <Link className="text-link" to="/works/$workId" params={{ workId: draft.id }}>查看公开页面</Link>}
          </section>
          <section className="panel">
            <h2 className="text-base font-mono text-on-surface-variant uppercase mb-4">
              审核设置
            </h2>
            <div className="space-y-4">
              <FormField label="预告审核状态">
                <select
                  className="field-input"
                  disabled={saving || Boolean(draft.publishedAt)}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      previewStatus: event.target
                        .value as UpdateProjectDraftInput["previewStatus"],
                    }))
                  }
                  value={form.previewStatus}
                >
                  {Object.entries(adminProjectDraftStatusLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </FormField>

              <FormField label="审查状态">
                <select
                  className="field-input"
                  disabled={saving || Boolean(draft.publishedAt)}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      reviewStatus: event.target
                        .value as UpdateProjectDraftInput["reviewStatus"],
                    }))
                  }
                  value={form.reviewStatus}
                >
                  {Object.entries(adminProjectDraftStatusLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </FormField>

              <FormField label="管理员反馈">
                <textarea
                  className="field-input"
                  disabled={saving || Boolean(draft.publishedAt)}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      adminFeedback: event.target.value,
                    }))
                  }
                  rows={6}
                  value={form.adminFeedback ?? ""}
                />
              </FormField>
            </div>

            <div className="mt-6 pt-4 border-t border-outline-variant space-y-3">
              {message ? (
                <SidebarNotice>{message}</SidebarNotice>
              ) : null}
              <button
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-md hover:bg-primary/90 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={saving}
                onClick={() => void handleSave()}
                type="button"
              >
                {saving ? "保存中..." : "保存审核结果"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function DraftDetailShell({ description }: { description: string }) {
  return (
    <div className="page-content">
      <PageHeading
        title={<>作品审核详情</>}
        description={<>{description}</>}
      ></PageHeading>
    </div>
  );
}

function DraftStatusBadge({
  status,
  label,
}: {
  status: UpdateProjectDraftInput["previewStatus"];
  label: string;
}) {
  const tone = getStatusTone(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-sm font-medium",
        tone === "success" && "bg-tertiary/10 text-tertiary border-tertiary/20",
        tone === "warn" && "bg-error/10 text-error border-error/20",
        tone === "info" && "bg-primary/10 text-primary border-primary/20",
      )}
    >
      {tone === "success" ? (
        <CheckCircle2 className="w-3.5 h-3.5" />
      ) : tone === "warn" ? (
        <XCircle className="w-3.5 h-3.5" />
      ) : (
        <Clock className="w-3.5 h-3.5" />
      )}
      {label} {adminProjectDraftStatusLabels[status]}
    </span>
  );
}

function getStatusTone(
  status: UpdateProjectDraftInput["previewStatus"],
): "info" | "warn" | "success" {
  if (status === "approved") {
    return "success";
  }

  if (status === "changes_requested") {
    return "warn";
  }

  return "info";
}
