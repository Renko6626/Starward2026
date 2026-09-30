import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import {
  DetailItem,
  ReadError,
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
import { buildWindowFlagMap, getApplicationWindowLabel } from "../../shared/windows";
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
        <p>正在读取你的创作进度。</p>
      </div>
    );
  }
  if (!dashboard) {
    return (
      <div className="page-content">
        <PageHeading title="我的工作台" />
        <ReadError message={error || "暂时无法读取工作台。"} />
      </div>
    );
  }

  const isApprovedParticipant =
    dashboard.participant?.status === "approved" ||
    dashboard.participant?.status === "completed";
  const windowFlags = buildWindowFlagMap(dashboard.windows);
  const displayName = dashboard.profile?.creditName;
  const applicationWindow = dashboard.windows.find((item) => item.key === "application_open");
  const tasks = [
    ...(!dashboard.profile ? [{
      title: "完善个人档案",
      description: "补充署名和联系方式，方便主催与你沟通。",
      actionLabel: "完善个人档案",
      to: "/portal/profile" as const,
    }] : []),
    ...(isApprovedParticipant ? [
      {
        title: "确认接力时间段",
        description: dashboard.currentSegment
          ? `当前持有 ${dashboard.currentSegment.code} · ${dashboard.currentSegment.name}`
          : "查看可用时间段，并在开放期间认领。",
        actionLabel: "前往日程",
        to: "/portal/schedule" as const,
      },
      {
        title: "整理作品资料",
        description: dashboard.projectDraft
          ? `预告：${projectDraftStatusLabels[dashboard.projectDraft.previewStatus]}；审查：${projectDraftStatusLabels[dashboard.projectDraft.reviewStatus]}`
          : "填写作品预告、审查说明与相关链接。",
        actionLabel: "编辑作品资料",
        to: "/portal/project" as const,
      },
    ] : [{
      title: dashboard.application ? "查看报名进度" : "填写正式报名",
      description: dashboard.application
        ? windowFlags.applicationOpen
          ? "查看审核结果与反馈，审核通过前可修改报名。"
          : `${getApplicationWindowLabel(applicationWindow)}，暂时不能修改报名。可查看审核结果与反馈。`
        : windowFlags.applicationOpen
          ? "完善个人档案后，填写创作意向并提交报名。"
          : `${getApplicationWindowLabel(applicationWindow)}，可以先完善个人档案。`,
      actionLabel: "查看报名",
      to: "/portal/application" as const,
    }]),
  ];

  return (
    <div className="page-content">
      <PageHeading
        eyebrow="CREATOR WORKSPACE / 2026"
        title="我的工作台"
        description="在这里跟进报名、整理作品，准备下一次接力。"
      >
        <StatusBadge tone={isApprovedParticipant ? "success" : "muted"}>
          {isApprovedParticipant ? "审核已通过" : dashboard.application ? applicationStatusLabels[dashboard.application.status] : "报名未提交"}
        </StatusBadge>
      </PageHeading>
      <section className="dashboard-welcome">
        <div>
          <p className="eyebrow">HELLO, CREATOR</p>
          <h2>{displayName ? `${displayName}，欢迎回来。` : "欢迎回来。"}</h2>
          <p>
            {!dashboard.profile
              ? dashboard.application?.status === "approved"
                ? "报名已通过，请补充个人档案。"
                : "请先完善个人档案中的署名和联系方式。"
              : isApprovedParticipant
              ? "你的参与资格已经通过审核，可以继续确认接力日程和完善作品。"
              : dashboard.application
                ? `报名状态：${applicationStatusLabels[dashboard.application.status]}。审核通过后可填写作品资料。`
                : "先完善个人档案，再提交你的创作意向。你的故事，从这里开始。"}
          </p>
        </div>
        <Link
          className="button button--secondary"
          to={
            !dashboard.profile
              ? "/portal/profile"
              : isApprovedParticipant
                ? "/portal/project"
                : "/portal/application"
          }
        >
          {!dashboard.profile
            ? "完善个人档案"
            : isApprovedParticipant
              ? "继续整理作品"
              : "查看我的报名"}
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
              <DetailItem label="署名" value={displayName ?? "未填写"} />
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
