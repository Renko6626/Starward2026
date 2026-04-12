import { useEffect, useState, type ReactNode } from "react";
import { Link, getRouteApi } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Clock, XCircle } from "../../app/components/icons";
import { requestJson } from "../../app/lib/api";
import { cn } from "../../app/lib/cn";
import { formatDateTime } from "../../app/lib/format";
import {
  adminParticipantStatusLabels,
  type AdminParticipantDetailResponse,
  type AdminParticipantInviteResponse,
  type UpdateParticipantInput,
} from "../../shared/admin";

const participantRouteApi = getRouteApi("/admin/participants/$participantId");

type DetailState =
  | { status: "loading" }
  | { status: "ready"; payload: AdminParticipantDetailResponse }
  | { status: "error"; message: string };

const initialForm: UpdateParticipantInput = {
  displayName: "",
  contactHandle: "",
  status: "approved",
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
      const payload = await requestJson<AdminParticipantDetailResponse>(`/api/admin/participants/${participantId}`);
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
      const payload = await requestJson<AdminParticipantDetailResponse>(`/api/admin/participants/${participantId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          displayName: form.displayName,
          contactHandle: form.contactHandle?.trim() || undefined,
          status: form.status,
        } satisfies UpdateParticipantInput),
      });

      setState({ status: "ready", payload });
      setForm({
        displayName: payload.participant.displayName,
        contactHandle: payload.participant.contactHandle ?? "",
        status: payload.participant.status,
      });
      setMessage(
        payload.participant.status !== requestedStatus
          ? `已保存参与者设置。当前参与资格为${adminParticipantStatusLabels[payload.participant.status]}。`
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
        { method: "POST" },
      );

      setState({
        status: "ready",
        payload: {
          participant: payload.participant,
        },
      });
      setForm({
        displayName: payload.participant.displayName,
        contactHandle: payload.participant.contactHandle ?? "",
        status: payload.participant.status,
      });
      setMessage(payload.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "发送通过提醒邮件失败。");
    } finally {
      setSendingInvite(false);
    }
  }

  if (state.status === "loading") {
    return <ParticipantDetailShell description="正在读取参与者详情。" />;
  }

  if (state.status === "error") {
    return <ParticipantDetailShell description={state.message} />;
  }

  const participant = state.payload.participant;

  return (
    <div className="max-w-5xl mx-auto relative z-10 py-6 space-y-6">
      <div className="mb-4">
        <Link
          className="text-sm font-mono text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2 mb-4"
          to="/admin/participants"
        >
          <ArrowRight className="w-4 h-4 rotate-180" /> 返回名册
        </Link>
        <div className="flex items-end justify-between border-b border-outline-variant pb-4 gap-4">
          <div>
            <h1 className="text-2xl font-headline tracking-tight mb-1">参与者详情</h1>
            <p className="text-sm text-on-surface-variant font-mono">ID: {participant.id}</p>
          </div>
          <ParticipantStatusBadge status={participant.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="p-6 border border-outline-variant bg-surface-container-low/50 rounded-xl space-y-6">
            <h2 className="text-sm font-mono text-on-surface-variant uppercase border-b border-outline-variant pb-2">
              基础信息
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <DetailItem label="显示名" value={participant.displayName} />
              <DetailItem label="登录邮箱" value={participant.inviteEmail} />
              <DetailItem label="联系方式备注" value={participant.contactHandle ?? "未填写"} />
              <DetailItem label="门户用户 ID" value={participant.userId ?? "尚未绑定"} />
              <DetailItem label="通过时间" value={formatDateTime(participant.invitedAt)} />
              <DetailItem label="门户激活" value={participant.activatedAt ? "已激活" : "未激活"} />
              <DetailItem label="激活时间" value={formatDateTime(participant.activatedAt)} />
              <DetailItem label="最近更新时间" value={formatDateTime(participant.updatedAt)} />
              <DetailItem
                label="当前时间段"
                value={
                  participant.currentSegmentCode
                    ? `${participant.currentSegmentCode} · ${participant.currentSegmentName ?? "已命名"}`
                    : "暂无"
                }
              />
            </div>
          </section>

          <section className="p-6 border border-outline-variant bg-surface-container-low/50 rounded-xl space-y-6">
            <h2 className="text-sm font-mono text-on-surface-variant uppercase border-b border-outline-variant pb-2">
              关联记录
            </h2>
            <div className="space-y-4">
              <DetailBlock
                title="入口说明"
                value="当前项目只有一套参与者入口。提醒邮件不会创建第二套账号体系，而是提醒对方继续使用当前邮箱通过 /portal/login 收验证码进入。"
              />
              <DetailBlock
                title="资格说明"
                value="验证码登录会自动建立创作者工作台；参与资格是否开放，由这里的状态字段控制。只有已批准状态才应进入时间段等正式动作。"
              />
              <DetailBlock
                title="维护建议"
                value={
                  participant.status === "withdrawn"
                    ? "该创作者已撤回。可以保留记录用于追踪，但不建议继续发送通过提醒。"
                    : participant.currentSegmentCode
                      ? `当前已持有 ${participant.currentSegmentCode}，如需改坑或释放，应转到时间段页处理。`
                      : participant.status === "pending"
                        ? "当前仍处于待审核状态，可继续观察作品与资料准备情况。"
                        : "当前尚未持有时间段，可在时间段页完成认领或人工分配。"
                }
              />
            </div>

            {participant.applicationId ? (
              <Link
                className="inline-flex min-h-10 items-center justify-center gap-2 px-4 py-2 bg-surface-variant border border-outline-variant rounded-md hover:bg-surface-bright transition-colors font-medium"
                params={{ applicationId: participant.applicationId }}
                to="/admin/applications/$applicationId"
              >
                查看原报名
              </Link>
            ) : null}
          </section>
        </div>

        <div className="space-y-6">
          <section className="p-6 border border-outline-variant bg-surface-container-low/80 rounded-xl shadow-lg">
            <h2 className="text-sm font-mono text-on-surface-variant uppercase mb-4">参与者设置</h2>
            <div className="space-y-4">
              <FormField label="显示名">
                <input
                  className="w-full bg-surface-variant border border-outline-variant rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  disabled={saving || sendingInvite}
                  onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                  value={form.displayName}
                />
              </FormField>

              <FormField label="联系方式备注">
                <input
                  className="w-full bg-surface-variant border border-outline-variant rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  disabled={saving || sendingInvite}
                  onChange={(event) => setForm({ ...form, contactHandle: event.target.value })}
                  placeholder="QQ / Telegram / Discord / 其他"
                  value={form.contactHandle ?? ""}
                />
              </FormField>

              <FormField label="参与资格">
                <select
                  className="w-full bg-surface-variant border border-outline-variant rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
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
              </FormField>
            </div>

            <div className="mt-6 pt-4 border-t border-outline-variant space-y-3">
              <SidebarNotice>
                资格状态与门户激活已分离。是否完成门户激活，请以“门户激活 / 激活时间”字段为准。
              </SidebarNotice>
              {message ? <SidebarNotice tone="success">{message}</SidebarNotice> : null}

              <button
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-md hover:bg-primary/90 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={saving || sendingInvite}
                onClick={() => void handleSave()}
                type="button"
              >
                {saving ? "保存中..." : "保存参与者设置"}
              </button>

              <button
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-surface-variant text-on-surface border border-outline-variant rounded-md hover:bg-surface-bright transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={
                  saving ||
                  sendingInvite ||
                  (participant.status !== "approved" && participant.status !== "completed")
                }
                onClick={() => void handleSendInvite()}
                type="button"
              >
                {sendingInvite ? "发送中..." : "发送通过提醒邮件"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ParticipantDetailShell({ description }: { description: string }) {
  return (
    <div className="max-w-5xl mx-auto relative z-10 py-6 space-y-6">
      <div className="flex items-end justify-between border-b border-outline-variant pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-headline tracking-tight mb-1">参与者详情</h1>
          <p className="text-sm text-on-surface-variant font-mono">{description}</p>
        </div>
      </div>
    </div>
  );
}

function ParticipantStatusBadge({
  status,
}: {
  status: UpdateParticipantInput["status"];
}) {
  if (status === "approved" || status === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary border border-tertiary/20 text-xs font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" /> {adminParticipantStatusLabels[status]}
      </span>
    );
  }

  if (status === "withdrawn") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-error/10 text-error border border-error/20 text-xs font-medium">
        <XCircle className="w-3.5 h-3.5" /> {adminParticipantStatusLabels[status]}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-medium">
      <Clock className="w-3.5 h-3.5" /> {adminParticipantStatusLabels[status]}
    </span>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-on-surface-variant mb-1">{label}</div>
      <div className="font-medium text-on-surface break-words">{value}</div>
    </div>
  );
}

function DetailBlock({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-on-surface mb-2">{title}</h3>
      <p className="text-sm text-on-surface-variant leading-relaxed bg-surface-variant/30 p-3 rounded-md border border-outline-variant/50 whitespace-pre-wrap">
        {value}
      </p>
    </div>
  );
}

function SidebarNotice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-xs leading-6",
        tone === "success"
          ? "border-tertiary/25 bg-tertiary/10 text-tertiary"
          : "border-outline-variant bg-surface-variant/30 text-on-surface-variant",
      )}
    >
      {children}
    </div>
  );
}
