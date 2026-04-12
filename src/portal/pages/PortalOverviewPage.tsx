import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Calendar, CheckCircle2, Clock, FileText, LogOut, UserRound } from "../../app/components/icons";
import { ApiError, requestJson } from "../../app/lib/api";
import { formatDateTime } from "../../app/lib/format";
import { cn } from "../../app/lib/cn";
import { applicationStatusLabels } from "../../shared/applications";
import { participantPortalStatusLabels, type PortalDashboardResponse } from "../../shared/portal";
import { buildWindowFlagMap } from "../../shared/windows";
import { authClient } from "../lib/auth-client";

export function PortalOverviewPage() {
  const navigate = useNavigate();
  const sessionQuery = authClient.useSession();
  const [dashboard, setDashboard] = useState<PortalDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!sessionQuery.isPending && !sessionQuery.data) {
      void navigate({ to: "/portal/login" });
      return;
    }

    if (!sessionQuery.data) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void requestJson<PortalDashboardResponse>("/api/portal/dashboard")
      .then((response) => {
        if (!cancelled) {
          setDashboard(response);
          setIsLoading(false);
        }
      })
      .catch((caught) => {
        if (cancelled) {
          return;
        }

        if (caught instanceof ApiError && caught.status === 401) {
          void navigate({ to: "/portal/login" });
          return;
        }

        setError(caught instanceof Error ? caught.message : "参与者门户数据加载失败。");
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, sessionQuery.data, sessionQuery.isPending]);

  async function handleSignOut() {
    await authClient.signOut();
    void navigate({ to: "/portal/login" });
  }

  if (sessionQuery.isPending || isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 relative z-10 py-6">
        <div className="flex items-end justify-between border-b border-outline-variant pb-4">
          <div>
            <h1 className="text-3xl font-headline tracking-tight mb-1">创作者工作台</h1>
            <p className="text-on-surface-variant font-mono text-sm">正在读取当前账号状态</p>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 relative z-10 py-6">
        <div className="flex items-end justify-between border-b border-outline-variant pb-4">
          <div>
            <h1 className="text-3xl font-headline tracking-tight mb-1">创作者工作台</h1>
            <p className="text-on-surface-variant font-mono text-sm">{error || "暂时无法读取参与者数据。"}</p>
          </div>
        </div>
      </div>
    );
  }

  const hasParticipant = Boolean(dashboard.participant);
  const windowFlags = buildWindowFlagMap(dashboard.windows);
  const displayName = dashboard.profile?.penName ?? dashboard.profile?.publicCreditName ?? dashboard.user.email;
  const tasks = hasParticipant
    ? [
        {
          icon: <Calendar className="w-5 h-5" />,
          title: "确认接力时段",
          description: dashboard.currentSegment
            ? `当前持有 ${dashboard.currentSegment.code} · ${dashboard.currentSegment.name}`
            : "查看并确认当前可用时间段，必要时执行变更或释放。",
          actionLabel: "前往日程",
          to: "/portal/schedule" as const,
          urgent: !dashboard.currentSegment,
        },
        {
          icon: <FileText className="w-5 h-5" />,
          title: "提交接力稿件",
          description: dashboard.projectDraft
            ? `预告 ${dashboard.projectDraft.previewStatus} / 审查 ${dashboard.projectDraft.reviewStatus}`
            : "上传你的接力作品草稿或成稿。",
          actionLabel: "打开工作台",
          to: "/portal/project" as const,
          urgent: windowFlags.previewSubmitOpen || windowFlags.reviewSubmitOpen,
        },
      ]
    : [
        {
          icon: <UserRound className="w-5 h-5" />,
          title: "完善报名信息",
          description: dashboard.profile ? "联系资料已存在，可继续检查公开署名设置。" : "先补充主联系资料和公开署名方式。",
          actionLabel: "编辑资料",
          to: "/portal/profile" as const,
          urgent: !dashboard.profile,
        },
        {
          icon: <AlertCircle className="w-5 h-5" />,
          title: "填写正式报名",
          description: dashboard.application
            ? windowFlags.applicationOpen
              ? "报名已提交，可继续修改至审核通过前。"
              : "报名已提交；当前报名窗口关闭，需等待主催重新开放后再修改。"
            : windowFlags.applicationOpen
              ? "补全报名正文、参加形式与作品链接。"
              : "当前报名窗口关闭，可先补齐联系资料并等待主催开启。",
          actionLabel: "查看报名表",
          to: "/portal/application" as const,
          urgent: !dashboard.application && windowFlags.applicationOpen,
        },
      ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 relative z-10 py-6">
      <div className="flex items-end justify-between border-b border-outline-variant pb-4 gap-4">
        <div>
          <h1 className="text-3xl font-headline tracking-tight mb-1">创作者工作台</h1>
          <p className="text-on-surface-variant font-mono text-sm">ID: {dashboard.user.id} • {dashboard.user.email}</p>
        </div>
        <div className="text-right space-y-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-tertiary/10 text-tertiary border border-tertiary/20 text-xs font-mono font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
            {hasParticipant ? "参与者工作区" : "等待审核中"}
          </span>
          <div>
            <button className="text-xs font-mono text-on-surface-variant hover:text-primary transition-colors inline-flex items-center gap-2" onClick={() => void handleSignOut()} type="button">
              <LogOut className="w-4 h-4" /> 退出登录
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <div className="p-6 border border-outline-variant bg-surface-container-low/50 rounded-xl">
            <h2 className="text-sm font-mono text-on-surface-variant uppercase mb-4">当前状态</h2>
            {hasParticipant ? (
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-tertiary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-lg text-tertiary">报名已通过</p>
                  <p className="text-sm text-on-surface-variant mt-1">当前资格状态：{participantPortalStatusLabels[dashboard.participant!.status]}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <Clock className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-lg text-primary">{dashboard.application ? applicationStatusLabels[dashboard.application.status] : "待审核"}</p>
                  <p className="text-sm text-on-surface-variant mt-1">当前账号已完成入口登录，但仍需等待主催完成报名审核。</p>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border border-outline-variant bg-surface-container-low/50 rounded-xl">
            <h2 className="text-sm font-mono text-on-surface-variant uppercase mb-4">身份摘要</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-on-surface-variant">社团/笔名</dt>
                <dd className="font-mono">{displayName}</dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">联系邮箱</dt>
                <dd className="font-mono">{dashboard.profile?.contactEmail ?? dashboard.user.email}</dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">联系资料</dt>
                <dd className="font-mono">{dashboard.profile ? "已补齐" : "待补充"}</dd>
              </div>
            </dl>
            <Link className="mt-4 text-xs font-mono text-primary hover:underline block" to="/portal/profile">
              编辑资料 -{">"}
            </Link>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 border border-outline-variant bg-surface-container-low/80 rounded-xl shadow-lg">
            <h2 className="text-sm font-mono text-on-surface-variant uppercase mb-4">待办事项</h2>
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  className={cn(
                    "flex items-center justify-between p-4 rounded-lg border bg-surface-variant/50 transition-colors hover:bg-surface-variant flex-col sm:flex-row gap-4 sm:gap-6",
                    task.urgent ? "border-primary/50" : "border-outline-variant/50",
                  )}
                  key={task.title}
                >
                  <div className="flex items-start gap-4 w-full">
                    <div className={cn("mt-1", task.urgent ? "text-primary" : "text-on-surface-variant")}>{task.icon}</div>
                    <div>
                      <h3 className="font-medium text-on-surface">{task.title}</h3>
                      <p className="text-sm text-on-surface-variant mt-0.5">{task.description}</p>
                    </div>
                  </div>
                  <Link
                    className={cn(
                      "px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap w-full sm:w-auto text-center",
                      task.urgent ? "bg-primary text-on-primary hover:bg-primary/90" : "bg-surface-bright text-on-surface hover:bg-outline-variant",
                    )}
                    to={task.to}
                  >
                    {task.actionLabel}
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 border border-outline-variant bg-surface-container-low/50 rounded-xl">
            <h2 className="text-sm font-mono text-on-surface-variant uppercase mb-4">近期事件</h2>
            {dashboard.recentEvents.length > 0 ? (
              <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-2 before:w-px before:bg-outline-variant">
                {dashboard.recentEvents.map((item) => (
                  <div className="relative pl-6" key={item.id}>
                    <div className="absolute left-[5px] top-1.5 w-1.5 h-1.5 rounded-full bg-on-surface-variant ring-4 ring-surface-container-low" />
                    <time className="text-xs font-mono text-on-surface-variant block mb-0.5">{formatDateTime(item.createdAt)}</time>
                    <p className="text-sm text-on-surface">{item.label}</p>
                    <p className="text-xs text-on-surface-variant">{item.actorLabel}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant">当前还没有可显示的门户事件。</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
