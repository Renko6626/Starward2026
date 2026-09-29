import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import {
  DetailItem,
  Notice,
  PageHeading,
  StatusBadge,
} from "../../app/components/ui";
import { ApiError, requestJson } from "../../app/lib/api";
import { formatDateTime } from "../../app/lib/format";
import { applicationStatusLabels } from "../../shared/applications";
import {
  projectDraftStatusLabels,
  type PortalDashboardResponse,
} from "../../shared/portal";
import { buildWindowFlagMap } from "../../shared/windows";
import { authClient } from "../lib/auth-client";

export function PortalOverviewPage() {
  const navigate = useNavigate();
  const sessionQuery = authClient.useSession();
  const [dashboard, setDashboard] = useState<PortalDashboardResponse | null>(
    null,
  );
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

        setError(
          caught instanceof Error ? caught.message : "参与者门户数据加载失败。",
        );
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, sessionQuery.data, sessionQuery.isPending]);

  if (sessionQuery.isPending || isLoading) {
    return (
      <div className="page-content">
        <PageHeading eyebrow="CREATOR WORKSPACE" title="我的工作台" />
        <Notice>正在读取你的创作进度。</Notice>
      </div>
    );
  }
  if (!dashboard) {
    return (
      <div className="page-content">
        <PageHeading title="我的工作台" />
        <Notice tone="error">{error || "暂时无法读取工作台。"}</Notice>
      </div>
    );
  }

  const isApprovedParticipant =
    dashboard.participant?.status === "approved" ||
    dashboard.participant?.status === "completed";
  const windowFlags = buildWindowFlagMap(dashboard.windows);
  const displayName = dashboard.profile?.creditName || dashboard.user.email;
  const tasks = isApprovedParticipant
    ? [
        {
          title: "确认接力时段",
          description: dashboard.currentSegment
            ? `当前持有 ${dashboard.currentSegment.code} · ${dashboard.currentSegment.name}`
            : "查看并确认当前可用时间段，必要时执行变更或释放。",
          actionLabel: "前往日程",
          to: "/portal/schedule" as const,
        },
        {
          title: "整理作品资料",
          description: dashboard.projectDraft
            ? `预告 ${projectDraftStatusLabels[dashboard.projectDraft.previewStatus]} / 审查 ${projectDraftStatusLabels[dashboard.projectDraft.reviewStatus]}`
            : "填写作品预告、审查说明与相关链接。",
          actionLabel: "编辑作品资料",
          to: "/portal/project" as const,
        },
      ]
    : [
        {
          title: "完善报名信息",
          description: dashboard.profile
            ? "联系资料已存在，可继续检查公开署名设置。"
            : "先补充主联系资料和署名设置。",
          actionLabel: "编辑资料",
          to: "/portal/profile" as const,
        },
        {
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
        },
        {
          title: "提前整理作品资料",
          description: dashboard.projectDraft
            ? `预告 ${projectDraftStatusLabels[dashboard.projectDraft.previewStatus]} / 审查 ${projectDraftStatusLabels[dashboard.projectDraft.reviewStatus]}`
            : "现在就可以先填写预告与审查说明，审核通过后继续进入排期与正式动作。",
          actionLabel: "打开作品页",
          to: "/portal/project" as const,
        },
      ];

  return (
    <div className="page-content">
      <PageHeading
        eyebrow="CREATOR WORKSPACE / 2026"
        title="我的工作台"
        description="在这里跟进报名、整理作品，准备下一次接力。"
      >
        <StatusBadge tone={isApprovedParticipant ? "success" : "muted"}>
          {isApprovedParticipant ? "参与资格已开放" : "创作准备中"}
        </StatusBadge>
      </PageHeading>
      <section className="dashboard-welcome">
        <div>
          <p className="eyebrow">HELLO, CREATOR</p>
          <h2>{displayName}，欢迎回来。</h2>
          <p>
            {isApprovedParticipant
              ? "你的参与资格已经通过审核，可以继续确认接力日程和完善作品。"
              : dashboard.application
                ? `你的报名目前${applicationStatusLabels[dashboard.application.status]}。等待期间，也可以先整理作品资料。`
                : "先完善个人档案，再提交你的创作意向。你的故事，从这里开始。"}
          </p>
        </div>
        <Link
          className="button button--secondary"
          to={
            isApprovedParticipant
              ? "/portal/project"
              : dashboard.profile
                ? "/portal/application"
                : "/portal/profile"
          }
        >
          {isApprovedParticipant
            ? "继续整理作品"
            : dashboard.profile
              ? "查看我的报名"
              : "完善个人档案"}
          <ArrowUpRight size={16} />
        </Link>
      </section>
      <div className="dashboard-grid">
        <section className="panel">
          <h2 className="panel-title">接下来要做的事</h2>
          {tasks.map((task, index) => (
            <article className="task-row" key={task.title}>
              <span>0{index + 1}</span>
              <div>
                <h3>{task.title}</h3>
                <p>{task.description}</p>
              </div>
              <Link className="text-link" to={task.to}>
                {task.actionLabel}
                <ArrowUpRight size={14} />
              </Link>
            </article>
          ))}
        </section>
        <div className="space-y-7">
          <section className="panel">
            <h2 className="panel-title">我的档案</h2>
            <div className="space-y-5">
              <DetailItem label="署名" value={displayName} />
              <DetailItem
                label="联系邮箱"
                value={dashboard.profile?.contactEmail ?? dashboard.user.email}
              />
              <DetailItem
                label="资料状态"
                value={dashboard.profile ? "已填写" : "待补充"}
              />
            </div>
            <Link className="text-link mt-6" to="/portal/profile">
              编辑个人档案 <ArrowUpRight size={14} />
            </Link>
          </section>
          <section className="panel">
            <h2 className="panel-title">最近的进展</h2>
            {dashboard.recentEvents.length ? (
              <div className="timeline">
                {dashboard.recentEvents.map((item) => (
                  <article key={item.id}>
                    <time>{formatDateTime(item.createdAt)}</time>
                    <p>{item.label}</p>
                    <small>{item.actorLabel}</small>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-base text-on-surface-variant leading-7">
                还没有新的记录。完成资料或提交报名后，进展会显示在这里。
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
