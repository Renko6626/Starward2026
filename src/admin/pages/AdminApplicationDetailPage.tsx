import { useEffect, useState } from "react";
import { Link, getRouteApi } from "@tanstack/react-router";
import {
  applicationInterestFormatLabels,
  applicationStatusLabels,
  type AdminApplicationDetailResponse,
  type UpdateApplicationReviewInput,
} from "../../shared/applications";
import { SectionCard } from "../../app/components/SectionCard";
import { requestJson } from "../../app/lib/api";
import { formatDateTime } from "../../app/lib/format";
import { StatusBadge } from "../../app/components/StatusBadge";

const applicationRouteApi = getRouteApi("/admin/applications/$applicationId");

export function AdminApplicationDetailPage() {
  const { applicationId } = applicationRouteApi.useParams();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; payload: AdminApplicationDetailResponse }
    | { status: "error"; message: string }
  >({ status: "loading" });
  const [adminNote, setAdminNote] = useState("");
  const [submitting, setSubmitting] = useState<UpdateApplicationReviewInput["status"] | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadDetail();
  }, [applicationId]);

  async function loadDetail() {
    setState({ status: "loading" });

    try {
      const payload = await requestJson<AdminApplicationDetailResponse>(
        `/api/admin/applications/${applicationId}`,
      );
      setState({ status: "ready", payload });
      setAdminNote(payload.application.adminNote ?? "");
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "无法读取报名详情。",
      });
    }
  }

  async function handleReview(status: UpdateApplicationReviewInput["status"]) {
    setSubmitting(status);
    setActionMessage(null);

    try {
      const payload = await requestJson<AdminApplicationDetailResponse>(
        `/api/admin/applications/${applicationId}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            status,
            adminNote: adminNote.trim() || undefined,
          } satisfies UpdateApplicationReviewInput),
        },
      );

      setState({ status: "ready", payload });
      setAdminNote(payload.application.adminNote ?? "");
      setActionMessage(`已更新为${applicationStatusLabels[payload.application.status]}。`);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "审核动作失败。");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="page-stack">
      {state.status === "loading" ? <p>正在读取报名详情。</p> : null}
      {state.status === "error" ? (
        <p className="inline-message inline-message--error">{state.message}</p>
      ) : null}
      {state.status === "ready" ? (
      <SectionCard
        eyebrow="后台 / 报名详情"
        title={`审核 ${state.payload.application.displayName}`}
        description="批准后会自动创建或对齐 `participants` 记录，并预留门户登录资格。"
      >
        <div className="detail-grid">
          <div className="mini-card mini-card--compact">
            <StatusBadge label={applicationStatusLabels[state.payload.application.status]} />
            <p>形式：{applicationInterestFormatLabels[state.payload.application.interestFormat]}</p>
            <p>提交时间：{formatDateTime(state.payload.application.createdAt)}</p>
            <p>审核时间：{formatDateTime(state.payload.application.reviewedAt)}</p>
          </div>
          <div className="mini-card mini-card--compact">
            <strong>联系邮箱</strong>
            <p>{state.payload.application.contactEmail}</p>
            <strong>联系方式备注</strong>
            <p>{state.payload.application.contactHandle ?? "未填写"}</p>
          </div>
          <div className="mini-card mini-card--compact">
            <strong>作品链接</strong>
            <p>{state.payload.application.portfolioUrl ?? "未填写"}</p>
            <strong>关联参与者</strong>
            {state.payload.application.participant ? (
              <p>
                <Link
                  className="button button--secondary"
                  params={{ participantId: state.payload.application.participant.id }}
                  to="/admin/participants/$participantId"
                >
                  {`${state.payload.application.participant.id} / ${state.payload.application.participant.status}`}
                </Link>
              </p>
            ) : (
              <p>尚未创建</p>
            )}
          </div>
        </div>

        <div className="grid-two">
          <div className="mini-card mini-card--compact">
            <strong>自我介绍 / 参加意向</strong>
            <p>{state.payload.application.introText ?? "未填写"}</p>
          </div>
          <div className="mini-card mini-card--compact">
            <strong>给主催的话</strong>
            <p>{state.payload.application.messageToHosts ?? "未填写"}</p>
          </div>
        </div>

        <label className="field">
          <span>内部备注</span>
          <textarea
            onChange={(event) => setAdminNote(event.target.value)}
            rows={5}
            value={adminNote}
          />
        </label>

        {actionMessage ? <p className="inline-message">{actionMessage}</p> : null}

        <div className="action-row">
          <button
            className="button button--primary"
            disabled={submitting !== null}
            onClick={() => void handleReview("approved")}
            type="button"
          >
            {submitting === "approved" ? "处理中" : "批准并转入参与者"}
          </button>
          <button
            className="button button--danger"
            disabled={submitting !== null}
            onClick={() => void handleReview("rejected")}
            type="button"
          >
            {submitting === "rejected" ? "处理中" : "拒绝"}
          </button>
          <button
            className="button button--secondary"
            disabled={submitting !== null}
            onClick={() => void handleReview("withdrawn")}
            type="button"
          >
            {submitting === "withdrawn" ? "处理中" : "标记撤回"}
          </button>
        </div>
      </SectionCard>
      ) : null}
    </div>
  );
}
