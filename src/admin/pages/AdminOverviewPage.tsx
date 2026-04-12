import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Clock3, FileText, Scroll, Sparkles, UserRound } from "../../app/components/icons";
import { requestJson } from "../../app/lib/api";
import { cn } from "../../app/lib/cn";
import { formatDateTime } from "../../app/lib/format";
import type { AdminApplicationListResponse } from "../../shared/applications";
import type {
  AdminParticipantListResponse,
  AdminProjectDraftListResponse,
  AdminSegmentListResponse,
} from "../../shared/admin";

type OverviewState =
  | { status: "loading" }
  | {
      status: "ready";
      applications: AdminApplicationListResponse["items"];
      participants: AdminParticipantListResponse["items"];
      drafts: AdminProjectDraftListResponse["items"];
      segments: AdminSegmentListResponse["items"];
    }
  | { status: "error"; message: string };

export function AdminOverviewPage() {
  const [state, setState] = useState<OverviewState>({ status: "loading" });

  useEffect(() => {
    void Promise.all([
      requestJson<AdminApplicationListResponse>("/api/admin/applications"),
      requestJson<AdminParticipantListResponse>("/api/admin/participants"),
      requestJson<AdminProjectDraftListResponse>("/api/admin/project-drafts"),
      requestJson<AdminSegmentListResponse>("/api/admin/segments"),
    ])
      .then(([applications, participants, drafts, segments]) =>
        setState({
          status: "ready",
          applications: applications.items,
          participants: participants.items,
          drafts: drafts.items,
          segments: segments.items,
        }),
      )
      .catch((error: Error) =>
        setState({
          status: "error",
          message: error.message || "无法读取后台总览数据。",
        }),
      );
  }, []);

  if (state.status === "loading") {
    return <AdminOverviewShell description="正在读取后台数据。" />;
  }

  if (state.status === "error") {
    return <AdminOverviewShell description={state.message} />;
  }

  const pendingApplications = state.applications.filter((item) => item.status === "pending").length;
  const confirmedParticipants = state.participants.filter((item) => item.status === "active" || item.status === "completed").length;
  const assignedSegments = state.segments.filter(
    (item) => item.status === "held" || item.status === "locked" || item.status === "completed",
  ).length;
  const scheduleProgress = state.segments.length > 0 ? Math.round((assignedSegments / state.segments.length) * 100) : 0;
  const submittedDrafts = state.drafts.filter(
    (item) => item.previewStatus !== "not_started" || item.reviewStatus !== "not_started",
  ).length;
  const recentFeed = buildFeedItems(state);

  return (
    <div className="max-w-6xl mx-auto space-y-8 relative z-10 py-6">
      <section>
        <div className="flex items-center justify-between mb-4 gap-4">
          <h1 className="text-2xl font-bold tracking-tight uppercase font-headline">组委会看板</h1>
          <span className="text-xs font-mono text-on-surface-variant">更新时间: {new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard title="已确认创作者" trend={confirmedParticipants > 0 ? `${confirmedParticipants}/${state.participants.length}` : undefined} trendUp={confirmedParticipants > 0} value={String(confirmedParticipants)} />
          <StatCard alert={state.segments.length > 0 && scheduleProgress < 100} title="排班完成度" value={state.segments.length > 0 ? `${scheduleProgress}%` : "未初始化"} />
          <StatCard title="收稿进度" value={`${submittedDrafts}/${state.drafts.length || 0}`} />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4 border-b border-outline-variant pb-2 gap-4">
          <h2 className="text-lg font-semibold uppercase tracking-wide font-headline">核心入口</h2>
          <div className="text-xs font-mono text-on-surface-variant">待审核报名 {pendingApplications} 条</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <QuickLink description="审核正式报名并转入参与者。" icon={<Scroll className="w-5 h-5" />} label="报名审核" to="/admin/applications" />
          <QuickLink description="维护参与者状态与入口提醒。" icon={<UserRound className="w-5 h-5" />} label="参与者名册" to="/admin/participants" />
          <QuickLink description="查看并修正时间段占用。" icon={<Clock3 className="w-5 h-5" />} label="时间段状态" to="/admin/schedule" />
          <QuickLink description="审阅预告资料与内容说明。" icon={<FileText className="w-5 h-5" />} label="资料审阅" to="/admin/project-drafts" />
          <QuickLink description="控制报名与门户动作开放时间。" icon={<Sparkles className="w-5 h-5" />} label="动作窗口" to="/admin/settings/windows" />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4 border-b border-outline-variant pb-2 gap-4">
          <h2 className="text-lg font-semibold uppercase tracking-wide font-headline">活动动态</h2>
          <div className="flex flex-wrap gap-2">
            <FlagTag tone="info">Cloudflare Access 继续保护后台</FlagTag>
            <FlagTag tone="success">参与者入口与后台已分离</FlagTag>
            <FlagTag tone="warn">公开发布仍不在本期范围</FlagTag>
          </div>
        </div>

        {recentFeed.length > 0 ? (
          <div className="space-y-4">
            {recentFeed.map((item) => (
              <FeedItem
                key={item.key}
                source={item.source}
                summary={item.summary}
                tags={item.tags}
                time={item.time}
                title={item.title}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-outline-variant bg-surface-container-low/80 p-6 text-sm text-on-surface-variant">
            当前还没有足够的报名、参与者或草案数据来形成后台动态。
          </div>
        )}
      </section>
    </div>
  );
}

function AdminOverviewShell({ description }: { description: string }) {
  return (
    <div className="max-w-6xl mx-auto space-y-8 relative z-10 py-6">
      <section>
        <div className="flex items-center justify-between mb-4 gap-4 border-b border-outline-variant pb-4">
          <h1 className="text-2xl font-bold tracking-tight uppercase font-headline">组委会看板</h1>
          <span className="text-xs font-mono text-on-surface-variant">后台总览</span>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container-low/80 p-6 text-sm text-on-surface-variant">
          {description}
        </div>
      </section>
    </div>
  );
}

function QuickLink({
  label,
  description,
  icon,
  to,
}: {
  label: string;
  description: string;
  icon: ReactNode;
  to: string;
}) {
  return (
    <Link
      className="p-4 rounded-lg border border-outline-variant bg-surface-container-low/80 backdrop-blur-sm hover:bg-surface-container transition-colors group"
      to={to}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-primary">{icon}</span>
        <span className="text-xs font-mono text-on-surface-variant">OPEN</span>
      </div>
      <h3 className="mt-4 text-base font-medium text-on-surface group-hover:text-primary transition-colors">{label}</h3>
      <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{description}</p>
    </Link>
  );
}

function StatCard({
  title,
  value,
  trend,
  trendUp,
  alert,
}: {
  title: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  alert?: boolean;
}) {
  return (
    <div
      className={cn(
        "p-4 rounded-lg border bg-surface-container-low/80 backdrop-blur-sm",
        alert ? "border-error/50" : "border-outline-variant",
      )}
    >
      <h3 className="text-xs font-mono text-on-surface-variant mb-2 uppercase">{title}</h3>
      <div className="flex items-end justify-between gap-4">
        <span className={cn("text-2xl font-bold tracking-tight", alert ? "text-error" : "text-on-surface")}>
          {value}
        </span>
        {trend ? (
          <span className={cn("text-xs font-mono mb-1", trendUp ? "text-tertiary" : "text-error")}>{trend}</span>
        ) : null}
      </div>
    </div>
  );
}

function FeedItem({
  time,
  source,
  title,
  summary,
  tags,
}: {
  time: string;
  source: string;
  title: string;
  summary: string;
  tags: string[];
}) {
  return (
    <article className="group relative pl-4 border-l-2 border-outline-variant hover:border-primary transition-colors">
      <div className="absolute -left-[9px] top-1.5 size-4 rounded-full bg-background border-2 border-outline-variant group-hover:border-primary transition-colors" />

      <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 mb-2">
        <time className="text-xs font-mono text-on-surface-variant w-32 flex-shrink-0">{time}</time>
        <span className="text-xs font-mono px-1.5 py-0.5 bg-surface-variant text-on-surface-variant rounded uppercase tracking-wider">
          {source}
        </span>
      </div>

      <div className="bg-surface-container-low/80 backdrop-blur-sm border border-outline-variant rounded-lg p-4 hover:bg-surface-container transition-colors">
        <h3 className="text-lg font-medium mb-2 group-hover:text-primary transition-colors">{title}</h3>
        <p className="text-sm text-on-surface-variant leading-relaxed mb-4">{summary}</p>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, index) => (
            <span
              key={`${tag}-${index}`}
              className="text-[10px] font-mono px-2 py-1 bg-surface-variant rounded-full text-on-surface-variant uppercase"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function FlagTag({ children, tone }: { children: string; tone: "info" | "warn" | "success" }) {
  return (
    <span
      className={cn(
        "text-[11px] font-mono px-2 py-1 rounded-full uppercase tracking-wide border",
        tone === "success" && "bg-tertiary/10 text-tertiary border-tertiary/25",
        tone === "warn" && "bg-primary/10 text-primary border-primary/25",
        tone === "info" && "bg-surface-variant text-on-surface-variant border-outline-variant",
      )}
    >
      {children}
    </span>
  );
}

function buildFeedItems(state: Extract<OverviewState, { status: "ready" }>) {
  const latestApplication = [...state.applications].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  const latestParticipant = [...state.participants].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  const latestDraft = [...state.drafts].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

  return [
    latestApplication
      ? {
          key: `application-${latestApplication.id}`,
          time: formatDateTime(latestApplication.createdAt),
          source: "APPLY",
          title: `${latestApplication.displayName || latestApplication.contactEmail} 提交了正式报名`,
          summary: `报名方向为 ${latestApplication.interestFormat}。当前审核状态为 ${latestApplication.status}，入口账号 ${latestApplication.authUserEmail ? "已建立" : "尚未建立"}。`,
          tags: ["application", latestApplication.status],
        }
      : null,
    latestParticipant
      ? {
          key: `participant-${latestParticipant.id}`,
          time: formatDateTime(latestParticipant.updatedAt),
          source: "PORTAL",
          title: `${latestParticipant.displayName} 当前处于参与者流程`,
          summary: latestParticipant.currentSegmentCode
            ? `当前持有时间段 ${latestParticipant.currentSegmentCode}，邮箱为 ${latestParticipant.inviteEmail}。`
            : `当前尚未分配时间段，参与状态为 ${latestParticipant.status}。`,
          tags: ["participant", latestParticipant.status],
        }
      : null,
    latestDraft
      ? {
          key: `draft-${latestDraft.id}`,
          time: formatDateTime(latestDraft.updatedAt),
          source: "DRAFT",
          title: `${latestDraft.participantName} 的资料草案有更新`,
          summary: `预告状态 ${latestDraft.previewStatus}，审查状态 ${latestDraft.reviewStatus}。${latestDraft.previewTitle ? `当前标题为《${latestDraft.previewTitle}》。` : "当前还没有填写公开标题。"}`,
          tags: ["draft", latestDraft.previewStatus, latestDraft.reviewStatus],
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);
}
