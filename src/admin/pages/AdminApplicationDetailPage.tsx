import { Link, getRouteApi } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
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
  PageHeading,
  Notice as SidebarNotice,
} from "../../app/components/ui";
import { requestJson } from "../../app/lib/api";
import { cn } from "../../app/lib/cn";
import { formatDateTime } from "../../app/lib/format";
import {
  adminParticipantStatusLabels,
  type AdminParticipantInviteResponse,
} from "../../shared/admin";
import { resolveApplicationDisplayName } from "../../shared/application-identity";
import {
  applicationInterestFormatLabels,
  applicationStatusLabels,
  type AdminApplicationDetailResponse,
  type ApplicationStatus,
  type UpdateApplicationReviewInput,
} from "../../shared/applications";
import {
  listAvailableApplicationReviewStatuses,
  summarizeApplicationReviewState,
} from "../lib/application-review";
import { getReviewNoteTemplates } from "../lib/review-note";

const applicationRouteApi = getRouteApi("/admin/applications/$applicationId");

type ActionNotice = {
  tone: "success" | "error";
  message: string;
};

const reviewActionConfigs = {
  approved: {
    label: "批准并开放参与资格",
    tone: "success" as const,
    Icon: CheckCircle2,
  },
  rejected: {
    label: "拒绝申请",
    tone: "error" as const,
    Icon: XCircle,
  },
  withdrawn: {
    label: "标记撤回",
    tone: "neutral" as const,
    Icon: Clock,
  },
};

function resolvePublicCreditLabel(
  profile: NonNullable<
    AdminApplicationDetailResponse["application"]["portalProfile"]
  >,
) {
  return profile.isAnonymous ? "匿名" : profile.creditName;
}

export function AdminApplicationDetailPage() {
  const { applicationId } = applicationRouteApi.useParams();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; payload: AdminApplicationDetailResponse }
    | { status: "error"; message: string }
  >({ status: "loading" });
  const [adminNote, setAdminNote] = useState("");
  const [submitting, setSubmitting] = useState<
    UpdateApplicationReviewInput["status"] | null
  >(null);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [actionNotice, setActionNotice] = useState<ActionNotice | null>(null);

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
    setActionNotice(null);

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
      setActionNotice(
        payload.notification
          ? {
              tone:
                payload.notification.status === "failed" ? "error" : "success",
              message: payload.notification.message,
            }
          : {
              tone: "success",
              message: `已更新为${applicationStatusLabels[payload.application.status]}。`,
            },
      );
    } catch (error) {
      setActionNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "审核动作失败。",
      });
    } finally {
      setSubmitting(null);
    }
  }

  async function handleSendInvite(participantId: string) {
    setSendingInvite(true);
    setActionNotice(null);

    try {
      const payload = await requestJson<AdminParticipantInviteResponse>(
        `/api/admin/participants/${participantId}/invite`,
        { method: "POST" },
      );

      await loadDetail();
      setActionNotice({
        tone: "success",
        message: payload.message,
      });
    } catch (error) {
      setActionNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "发送通过提醒邮件失败。",
      });
    } finally {
      setSendingInvite(false);
    }
  }

  if (state.status === "loading") {
    return <ApplicationDetailShell description="正在读取报名详情。" />;
  }

  if (state.status === "error") {
    return (
      <div className="page-content">
        <PageHeading title="报名详情" />
        <ReadError message={state.message} />
      </div>
    );
  }

  const application = state.payload.application;
  const participant = application.participant;
  const summary = summarizeApplicationReviewState(application);
  const availableReviewStatuses = listAvailableApplicationReviewStatuses(
    application.status,
  );

  return (
    <div className="page-content">
      <div className="mb-4">
        <Link
          className="text-base font-mono text-on-surface-variant hover:text-primary transition-colors flex min-h-11 items-center gap-2 mb-4"
          to="/admin/applications"
        >
          <ArrowRight className="w-4 h-4 rotate-180" /> 返回队列
        </Link>
        <PageHeading
          title={<>报名详情</>}
          description={<>ID: {applicationId}</>}
        >
          <ApplicationStatusBadge status={application.status} />
        </PageHeading>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <section className="panel space-y-6">
            <h2 className="text-base font-mono text-on-surface-variant uppercase border-b border-outline-variant pb-2">
              基础信息
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-base">
              <DetailItem
                label="署名"
                value={resolveApplicationDisplayName({
                  displayName: application.displayName,
                  contactHandle: application.contactHandle,
                  contactEmail: application.contactEmail,
                })}
              />
              <DetailItem
                label="联系方式备注"
                value={application.contactHandle ?? "未填写"}
              />
              <DetailItem label="联系邮箱" value={application.contactEmail} />
              <DetailItem
                label="提交时间"
                value={formatDateTime(application.createdAt)}
              />
              <DetailItem
                label="报名方向"
                value={
                  applicationInterestFormatLabels[application.interestFormat]
                }
              />
              <DetailItem
                label="作品链接"
                value={application.portfolioUrl ?? "未填写"}
              />
              <DetailItem
                label="门户账号"
                value={application.authUser?.email ?? "尚未建立入口"}
              />
              <DetailItem
                label="审核时间"
                value={formatDateTime(application.reviewedAt)}
              />
            </div>
          </section>

          <section className="panel space-y-6">
            <h2 className="text-base font-mono text-on-surface-variant uppercase border-b border-outline-variant pb-2">
              联系资料与公开署名
            </h2>
            {application.portalProfile ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-base">
                <DetailItem
                  label="署名"
                  value={application.portalProfile.creditName ?? "未填写"}
                />
                <DetailItem
                  label="联系邮箱"
                  value={application.portalProfile.contactEmail}
                />
                <DetailItem
                  label="联系渠道"
                  value={`${application.portalProfile.primaryContactChannel} / ${application.portalProfile.primaryContactHandle}`}
                />
                <DetailItem
                  label="备用联系"
                  value={application.portalProfile.backupContact ?? "未填写"}
                />
                <DetailItem
                  label="对外署名"
                  value={resolvePublicCreditLabel(application.portalProfile)}
                />
              </div>
            ) : (
              <EmptyBlock>该报名尚未补充个人档案。</EmptyBlock>
            )}
          </section>

          <section className="panel space-y-6">
            <h2 className="text-base font-mono text-on-surface-variant uppercase border-b border-outline-variant pb-2">
              参企问卷
            </h2>
            <div className="space-y-4">
              <DetailBlock
                title="自我介绍 / 参加意向"
                value={application.introText ?? "未填写"}
              />
              <DetailBlock
                title="给主催的话"
                value={application.messageToHosts ?? "未填写"}
              />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="panel">
            <h2 className="text-base font-mono text-on-surface-variant uppercase mb-4">
              报名审核
            </h2>
            <div className="space-y-3">
              {availableReviewStatuses.map((status) => {
                const config = reviewActionConfigs[status];

                return (
                  <ActionButton
                    key={status}
                    disabled={submitting !== null || sendingInvite}
                    onClick={() => void handleReview(status)}
                    tone={config.tone}
                  >
                    <config.Icon className="w-4 h-4" />
                    {submitting === status ? "处理中..." : config.label}
                  </ActionButton>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-outline-variant space-y-4">
              <label
                className="text-sm font-medium text-on-surface-variant block"
                htmlFor="application-admin-note"
              >
                审核意见（创作者可见）
              </label>
              <textarea
                className="field-input"
                id="application-admin-note"
                onChange={(event) => setAdminNote(event.target.value)}
                placeholder="填写会展示给创作者的审核意见..."
                rows={6}
                value={adminNote}
              />

              <div className="flex flex-wrap gap-2">
                {getReviewNoteTemplates().map((template) => (
                  <button
                    key={template.id}
                    className="min-h-11 px-3 py-1.5 bg-surface-variant border border-outline-variant rounded-md text-sm hover:bg-surface-bright transition-colors"
                    onClick={() => setAdminNote(template.body)}
                    type="button"
                  >
                    {template.label}
                  </button>
                ))}
              </div>

              <SidebarNotice>
                这段意见会显示在创作者的报名页。模板只会写入输入框，不会自动提交。
              </SidebarNotice>
              {actionNotice ? (
                <SidebarNotice tone={actionNotice.tone}>
                  {actionNotice.message}
                </SidebarNotice>
              ) : null}

              {participant ? (
                <div className="space-y-3 border-t border-outline-variant pt-4">
                  <ActionButton
                    disabled={
                      submitting !== null ||
                      sendingInvite ||
                      !summary.inviteAction.enabled
                    }
                    onClick={() => void handleSendInvite(participant.id)}
                    tone="neutral"
                  >
                    {sendingInvite ? "发送中..." : summary.inviteAction.label}
                  </ActionButton>
                  <Link
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-surface-variant border border-outline-variant rounded-md hover:bg-surface-bright transition-colors font-medium"
                    params={{ participantId: participant.id }}
                    to="/admin/participants/$participantId"
                  >
                    查看参与者详情
                  </Link>
                  <p className="text-sm text-on-surface-variant">
                    关联创作者: {participant.id} /{" "}
                    {adminParticipantStatusLabels[participant.status]}
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="panel space-y-4">
            <h2 className="text-base font-mono text-on-surface-variant uppercase">
              审核上下文
            </h2>
            <div className="space-y-3">
              {summary.items.map((item) => (
                <div
                  key={item.key}
                  className="rounded-lg border border-outline-variant bg-surface-variant/30 p-4"
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm font-medium",
                      item.tone === "success" &&
                        "border-tertiary/20 bg-tertiary/10 text-tertiary",
                      item.tone === "warn" &&
                        "border-primary/20 bg-primary/10 text-primary",
                      item.tone === "info" &&
                        "border-outline-variant bg-surface-variant text-on-surface-variant",
                    )}
                  >
                    {item.statusLabel}
                  </span>
                  <p className="mt-3 text-base font-medium text-on-surface">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                    {item.hint}
                  </p>
                </div>
              ))}
            </div>
            <SidebarNotice>{summary.recommendation}</SidebarNotice>
            <SidebarNotice>{summary.inviteAction.reason}</SidebarNotice>
          </section>
        </div>
      </div>
    </div>
  );
}

function ApplicationDetailShell({ description }: { description: string }) {
  return (
    <div className="page-content">
      <PageHeading
        title={<>报名详情</>}
        description={<>{description}</>}
      ></PageHeading>
    </div>
  );
}

function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  switch (status) {
    case "approved":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary border border-tertiary/20 text-sm font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />{" "}
          {applicationStatusLabels[status]}
        </span>
      );
    case "rejected":
    case "withdrawn":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-error/10 text-error border border-error/20 text-sm font-medium">
          <XCircle className="w-3.5 h-3.5" /> {applicationStatusLabels[status]}
        </span>
      );
    case "pending":
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-sm font-medium">
          <Clock className="w-3.5 h-3.5" /> {applicationStatusLabels[status]}
        </span>
      );
  }
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled: boolean;
  tone: "success" | "error" | "neutral";
}) {
  return (
    <button
      className={cn(
        "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors font-medium disabled:cursor-not-allowed disabled:opacity-60",
        tone === "success" &&
          "bg-tertiary/10 text-tertiary border border-tertiary/30 hover:bg-tertiary/20",
        tone === "error" &&
          "bg-error/10 text-error border border-error/30 hover:bg-error/20",
        tone === "neutral" &&
          "bg-surface-variant text-on-surface border border-outline-variant hover:bg-outline-variant",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function EmptyBlock({ children }: { children: ReactNode }) {
  return (
    <div className="text-base text-on-surface-variant leading-relaxed bg-surface-variant/30 p-3 rounded-md border border-outline-variant/50">
      {children}
    </div>
  );
}
