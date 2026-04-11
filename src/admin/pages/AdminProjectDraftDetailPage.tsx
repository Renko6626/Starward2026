import { Link, getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  adminParticipantStatusLabels,
  adminProjectDraftStatusLabels,
  type AdminProjectDraftDetailResponse,
  type AdminProjectDraftMutationResponse,
  type UpdateProjectDraftInput,
} from "../../shared/admin";
import { SectionCard } from "../../app/components/SectionCard";
import { StatusBadge } from "../../app/components/StatusBadge";
import { requestJson } from "../../app/lib/api";
import { formatDateTime } from "../../app/lib/format";

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

      setState({
        status: "ready",
        payload: {
          draft: payload.draft,
        },
      });
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

  return (
    <div className="page-stack">
      {state.status === "loading" ? <p>正在读取资料详情。</p> : null}
      {state.status === "error" ? (
        <p className="inline-message inline-message--error">{state.message}</p>
      ) : null}
      {state.status === "ready" ? (
        <SectionCard
          eyebrow="后台 / 资料详情"
          title={`审阅 ${state.payload.draft.participantName} 的作品资料`}
          description="一期先把作者填写内容和管理员反馈放在同一页，减少来回跳转。管理员只改审核状态与反馈，不直接覆盖作者原文。"
        >
          <div className="detail-grid">
            <div className="mini-card mini-card--compact">
              <StatusBadge
                label={`预告 ${adminProjectDraftStatusLabels[state.payload.draft.previewStatus]}`}
                tone={getStatusTone(state.payload.draft.previewStatus)}
              />
              <p>
                <StatusBadge
                  label={`审查 ${adminProjectDraftStatusLabels[state.payload.draft.reviewStatus]}`}
                  tone={getStatusTone(state.payload.draft.reviewStatus)}
                />
              </p>
              <p>最近更新时间：{formatDateTime(state.payload.draft.updatedAt)}</p>
              <p>最近审核时间：{formatDateTime(state.payload.draft.reviewedAt)}</p>
            </div>

            <div className="mini-card mini-card--compact">
              <strong>参与者</strong>
              <p>{state.payload.draft.participantName}</p>
              <p>{state.payload.draft.participantInviteEmail}</p>
              <p>{adminParticipantStatusLabels[state.payload.draft.participantStatus]}</p>
              <p>{state.payload.draft.participantContactHandle ?? "未填写联系方式备注"}</p>
            </div>

            <div className="mini-card mini-card--compact">
              <strong>当前时间段</strong>
              <p>
                {state.payload.draft.segmentCode
                  ? `${state.payload.draft.segmentCode} · ${state.payload.draft.segmentName ?? "未命名"}`
                  : "暂无"}
              </p>
              <strong>关联参与者页</strong>
              <p>
                <Link
                  className="button button--secondary"
                  params={{ participantId: state.payload.draft.participantId }}
                  to="/admin/participants/$participantId"
                >
                  查看参与者详情
                </Link>
              </p>
            </div>
          </div>

          <div className="grid-two">
            <div className="mini-card mini-card--tall">
              <strong>预告信息</strong>
              <p>标题：{state.payload.draft.previewTitle ?? "未填写"}</p>
              <p>公开作者名：{state.payload.draft.publicAuthorName ?? "未填写"}</p>
              <p>作品形式：{state.payload.draft.formatLabel ?? "未填写"}</p>
              <p>标签：{state.payload.draft.publicTags.length > 0 ? state.payload.draft.publicTags.join(" / ") : "未填写"}</p>
              <p>提交时间：{formatDateTime(state.payload.draft.previewSubmittedAt)}</p>
              <strong>预告简介</strong>
              <p>{state.payload.draft.previewSummary ?? "未填写"}</p>
            </div>

            <div className="mini-card mini-card--tall">
              <strong>审查说明</strong>
              <p>提交时间：{formatDateTime(state.payload.draft.reviewSubmittedAt)}</p>
              <strong>内容概述</strong>
              <p>{state.payload.draft.contentNote ?? "未填写"}</p>
              <strong>内容警示</strong>
              <p>{state.payload.draft.contentWarnings ?? "未填写"}</p>
              <strong>补充说明</strong>
              <p>{state.payload.draft.reviewNote ?? "未填写"}</p>
            </div>
          </div>

          <div className="grid-two">
            <label className="field">
              <span>预告审核状态</span>
              <select
                disabled={saving}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    previewStatus: event.target.value as UpdateProjectDraftInput["previewStatus"],
                  }))
                }
                value={form.previewStatus}
              >
                {Object.entries(adminProjectDraftStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>审查审核状态</span>
              <select
                disabled={saving}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    reviewStatus: event.target.value as UpdateProjectDraftInput["reviewStatus"],
                  }))
                }
                value={form.reviewStatus}
              >
                {Object.entries(adminProjectDraftStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>管理员反馈</span>
            <textarea
              disabled={saving}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  adminFeedback: event.target.value,
                }))
              }
              rows={6}
              value={form.adminFeedback ?? ""}
            />
          </label>

          <p className="inline-message">
            这里的反馈会和审核状态一起落到 `project_drafts.admin_feedback`，供后续参与者门户直接读取。
          </p>
          {message ? <p className="inline-message">{message}</p> : null}

          <div className="action-row">
            <button
              className="button button--primary"
              disabled={saving}
              onClick={() => void handleSave()}
              type="button"
            >
              {saving ? "保存中" : "保存审核结果"}
            </button>
          </div>
        </SectionCard>
      ) : null}
    </div>
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
