import { Link, getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  adminParticipantStatusLabels,
  type AdminParticipantDetailResponse,
  type AdminParticipantInviteResponse,
  type UpdateParticipantInput,
} from "../../shared/admin";
import { SectionCard } from "../../app/components/SectionCard";
import { requestJson } from "../../app/lib/api";
import { formatDateTime } from "../../app/lib/format";
import { StatusBadge } from "../../app/components/StatusBadge";

const participantRouteApi = getRouteApi("/admin/participants/$participantId");

type DetailState =
  | { status: "loading" }
  | { status: "ready"; payload: AdminParticipantDetailResponse }
  | { status: "error"; message: string };

const initialForm: UpdateParticipantInput = {
  displayName: "",
  contactHandle: "",
  status: "invited",
};

export function AdminParticipantDetailPage() {
  const { participantId } = participantRouteApi.useParams();
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [form, setForm] = useState<UpdateParticipantInput>(initialForm);
  const [saving, setSaving] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadDetail();
  }, [participantId]);

  async function loadDetail() {
    setState({ status: "loading" });

    try {
      const payload = await requestJson<AdminParticipantDetailResponse>(
        `/api/admin/participants/${participantId}`,
      );
      setState({ status: "ready", payload });
      setForm({
        displayName: payload.participant.displayName,
        contactHandle: payload.participant.contactHandle ?? "",
        status: payload.participant.status,
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "无法读取参与者详情。",
      });
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const requestedStatus = form.status;
      const payload = await requestJson<AdminParticipantDetailResponse>(
        `/api/admin/participants/${participantId}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            displayName: form.displayName,
            contactHandle: form.contactHandle?.trim() || undefined,
            status: form.status,
          } satisfies UpdateParticipantInput),
        },
      );

      setState({ status: "ready", payload });
      setForm({
        displayName: payload.participant.displayName,
        contactHandle: payload.participant.contactHandle ?? "",
        status: payload.participant.status,
      });
      setMessage(
        payload.participant.status !== requestedStatus
          ? `已保存参与者设置。该账号已激活门户，状态保持为${adminParticipantStatusLabels[payload.participant.status]}。`
          : "已保存参与者设置。",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存参与者设置失败。");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendInvite() {
    setSendingInvite(true);
    setMessage(null);

    try {
      const payload = await requestJson<AdminParticipantInviteResponse>(
        `/api/admin/participants/${participantId}/invite`,
        {
          method: "POST",
        },
      );

      setState({
        status: "ready",
        payload: {
          participant: payload.participant,
        },
      });
      setMessage(payload.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "发送门户提醒邮件失败。");
    } finally {
      setSendingInvite(false);
    }
  }

  function getStatusTone(status: UpdateParticipantInput["status"]): "info" | "warn" | "success" {
    if (status === "active" || status === "completed") {
      return "success";
    }

    if (status === "withdrawn") {
      return "warn";
    }

    return "info";
  }

  return (
    <div className="page-stack">
      {state.status === "loading" ? <p>正在读取参与者详情。</p> : null}
      {state.status === "error" ? (
        <p className="inline-message inline-message--error">{state.message}</p>
      ) : null}
      {state.status === "ready" ? (
        <SectionCard
          eyebrow="后台 / 参与者详情"
          title={`管理 ${state.payload.participant.displayName}`}
          description="这里处理一期真正需要的参与者维护：状态调整、联系信息纠偏，以及手动补发门户入口提醒。"
        >
          <div className="detail-grid">
            <div className="mini-card mini-card--compact">
              <StatusBadge
                label={adminParticipantStatusLabels[state.payload.participant.status]}
                tone={getStatusTone(state.payload.participant.status)}
              />
              <p>受邀邮箱：{state.payload.participant.inviteEmail}</p>
              <p>转入时间：{formatDateTime(state.payload.participant.invitedAt)}</p>
              <p>激活时间：{formatDateTime(state.payload.participant.activatedAt)}</p>
            </div>

            <div className="mini-card mini-card--compact">
              <strong>当前时间段</strong>
              <p>
                {state.payload.participant.currentSegmentCode
                  ? `${state.payload.participant.currentSegmentCode} · ${state.payload.participant.currentSegmentName ?? "已命名"}`
                  : "暂无"}
              </p>
              <strong>门户用户 ID</strong>
              <p>{state.payload.participant.userId ?? "尚未绑定"}</p>
            </div>

            <div className="mini-card mini-card--compact">
              <strong>关联报名</strong>
              <p>
                {state.payload.participant.applicationId ? (
                  <Link
                    className="button button--secondary"
                    params={{ applicationId: state.payload.participant.applicationId }}
                    to="/admin/applications/$applicationId"
                  >
                    查看原报名
                  </Link>
                ) : (
                  "暂无"
                )}
              </p>
              <strong>最近更新时间</strong>
              <p>{formatDateTime(state.payload.participant.updatedAt)}</p>
            </div>
          </div>

          <div className="grid-two">
            <label className="field">
              <span>显示名</span>
              <input
                disabled={saving || sendingInvite}
                onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                value={form.displayName}
              />
            </label>

            <label className="field">
              <span>联系方式备注</span>
              <input
                disabled={saving || sendingInvite}
                onChange={(event) => setForm({ ...form, contactHandle: event.target.value })}
                placeholder="QQ / Telegram / Discord / 其他"
                value={form.contactHandle ?? ""}
              />
            </label>
          </div>

          <label className="field">
            <span>参与状态</span>
            <select
              disabled={saving || sendingInvite}
              onChange={(event) =>
                setForm({
                  ...form,
                  status: event.target.value as UpdateParticipantInput["status"],
                })
              }
              value={form.status}
            >
              {Object.entries(adminParticipantStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <p className="inline-message">
            手动提醒邮件不会创建第二套账号体系，只是提醒对方从同一个 `/portal/login` 入口用受邀邮箱收验证码登录。
          </p>
          {message ? <p className="inline-message">{message}</p> : null}

          <div className="action-row">
            <button
              className="button button--primary"
              disabled={saving || sendingInvite}
              onClick={() => void handleSave()}
              type="button"
            >
              {saving ? "保存中" : "保存参与者设置"}
            </button>
            <button
              className="button button--secondary"
              disabled={saving || sendingInvite || state.payload.participant.status === "withdrawn"}
              onClick={() => void handleSendInvite()}
              type="button"
            >
              {sendingInvite ? "发送中" : "发送门户提醒邮件"}
            </button>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
