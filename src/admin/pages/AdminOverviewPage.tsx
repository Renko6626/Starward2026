import {
  ReadError,
  MetricCard,
  Notice,
  PageHeading,
  StatusBadge,
} from "../../app/components/ui";
import {
  applicationInterestFormatLabels,
  applicationStatusLabels,
} from "../../shared/applications";
import {
  adminParticipantStatusLabels,
  adminProjectDraftStatusLabels,
} from "../../shared/admin";
import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Clock3,
  FileText,
  Scroll,
  Sparkles,
  UserRound,
} from "../../app/components/icons";
import { requestJson } from "../../app/lib/api";
import { formatDateTime } from "../../app/lib/format";
import { summarizeProjectProgress } from "../lib/project-progress";
import type {
  AdminParticipantListResponse,
  AdminProjectDraftListResponse,
  AdminSegmentListResponse,
} from "../../shared/admin";
import type { AdminApplicationListResponse } from "../../shared/applications";

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
    return (
      <div className="page-content">
        <PageHeading title="活动总览" />
        <ReadError message={state.message} />
      </div>
    );
  }

  const pendingApplications = state.applications.filter(
    (item) => item.status === "pending",
  ).length;
  const confirmedParticipants = state.participants.filter(
    (item) => item.status === "approved" || item.status === "completed",
  ).length;
  const assignedSegments = state.segments.filter(
    (item) =>
      item.status === "held" ||
      item.status === "locked" ||
      item.status === "completed",
  ).length;
  const scheduleProgress =
    state.segments.length > 0
      ? Math.round((assignedSegments / state.segments.length) * 100)
      : 0;
  const projectProgress = summarizeProjectProgress(state.drafts);
  const recentFeed = buildFeedItems(state);

  return (
    <div className="page-content">
      <PageHeading
        eyebrow="CONTROL ROOM / 2026"
        title="活动总览"
        description="从报名到交稿，跟进每一位创作者的参与进度。"
      />
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <MetricCard label="待审核报名" value={pendingApplications} />
        <MetricCard label="已确认创作者" value={confirmedParticipants} />
        <MetricCard
          label="排期完成度"
          value={state.segments.length ? `${scheduleProgress}%` : "—"}
        />
        <MetricCard
          label="草稿中"
          value={projectProgress.drafts}
        />
        <MetricCard
          label="已有正式提交 / 全部作品"
          value={`${projectProgress.submitted} / ${state.drafts.length}`}
        />
      </div>
      <div className="dashboard-welcome">
        <div>
          <p className="eyebrow">NEXT UP / 审核待办</p>
          <h2>
            {pendingApplications
              ? `${pendingApplications} 份报名，等待你的回应`
              : "报名队列已处理完毕"}
          </h2>
          <p>查看创作方向与联系资料，确认参与资格。</p>
        </div>
        <Link className="button button--primary" to="/admin/applications">
          进入报名审核 →
        </Link>
      </div>

      <section>
        <div className="flex items-center justify-between mb-4 border-b border-outline-variant pb-2 gap-4">
          <h2 className="text-lg font-semibold uppercase tracking-wide font-headline">
            核心入口
          </h2>
          <div className="text-sm font-mono text-on-surface-variant">
            待审核报名 {pendingApplications} 条
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <QuickLink
            description="审核正式报名并开放参与资格。"
            icon={<Scroll className="w-5 h-5" />}
            label="报名审核"
            to="/admin/applications"
          />
          <QuickLink
            description="维护参与者状态与入口提醒。"
            icon={<UserRound className="w-5 h-5" />}
            label="创作者名册"
            to="/admin/participants"
          />
          <QuickLink
            description="查看并修正时间段占用。"
            icon={<Clock3 className="w-5 h-5" />}
            label="接力排期"
            to="/admin/schedule"
          />
          <QuickLink
            description="审阅预告资料与内容说明。"
            icon={<FileText className="w-5 h-5" />}
            label="作品审核"
            to="/admin/project-drafts"
          />
          <QuickLink
            description="控制报名、时间段认领与资料提交的开放时间。"
            icon={<Sparkles className="w-5 h-5" />}
            label="开放窗口"
            to="/admin/settings/windows"
          />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4 border-b border-outline-variant pb-2 gap-4">
          <h2 className="text-lg font-semibold uppercase tracking-wide font-headline">
            活动动态
          </h2>
        </div>

        {recentFeed.length > 0 ? (
          <div className="panel activity-feed">
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
          <div className="panel text-base text-on-surface-variant">
            当前还没有足够的报名、参与者或草案数据来形成后台动态。
          </div>
        )}
      </section>
    </div>
  );
}

function AdminOverviewShell({ description }: { description: string }) {
  return (
    <div className="page-content">
      <PageHeading title="活动总览" />
      <Notice>{description}</Notice>
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
      className="panel hover:bg-surface-container transition-colors group"
      to={to}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-primary">{icon}</span>
        <span className="text-sm font-mono text-on-surface-variant">OPEN</span>
      </div>
      <h3 className="mt-4 text-base font-medium text-on-surface group-hover:text-primary transition-colors">
        {label}
      </h3>
      <p className="mt-2 text-base leading-relaxed text-on-surface-variant">
        {description}
      </p>
    </Link>
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
    <article className="activity-row">
      <div>
        <time>{time}</time>
        <span>{source}</span>
      </div>
      <div>
        <h3>{title}</h3>
        <p>{summary}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => (
          <StatusBadge key={`${tag}-${index}`}>{tag}</StatusBadge>
        ))}
      </div>
    </article>
  );
}

function buildFeedItems(state: Extract<OverviewState, { status: "ready" }>) {
  const latestApplication = [...state.applications].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  )[0];
  const latestParticipant = [...state.participants].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  )[0];
  const latestDraft = [...state.drafts].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  )[0];

  return [
    latestApplication
      ? {
          key: `application-${latestApplication.id}`,
          time: formatDateTime(latestApplication.createdAt),
          source: "报名",
          title: `${latestApplication.displayName || latestApplication.contactEmail} 提交了正式报名`,
          summary: `报名方向为 ${applicationInterestFormatLabels[latestApplication.interestFormat]}。当前审核状态为 ${applicationStatusLabels[latestApplication.status]}，入口账号 ${latestApplication.authUserEmail ? "已建立" : "尚未建立"}。`,
          tags: [applicationStatusLabels[latestApplication.status]],
        }
      : null,
    latestParticipant
      ? {
          key: `participant-${latestParticipant.id}`,
          time: formatDateTime(latestParticipant.updatedAt),
          source: "参与者",
          title: `${latestParticipant.displayName} 当前处于参与者流程`,
          summary: latestParticipant.currentSegmentCode
            ? `当前持有时间段 ${latestParticipant.currentSegmentCode}，邮箱为 ${latestParticipant.inviteEmail}。`
            : `当前尚未分配时间段，参与状态为 ${adminParticipantStatusLabels[latestParticipant.status]}。`,
          tags: [adminParticipantStatusLabels[latestParticipant.status]],
        }
      : null,
    latestDraft
      ? {
          key: `draft-${latestDraft.id}`,
          time: formatDateTime(latestDraft.updatedAt),
          source: "作品资料",
          title: `${latestDraft.participantName} 的资料草案有更新`,
          summary: `预告状态 ${adminProjectDraftStatusLabels[latestDraft.previewStatus]}，审查状态 ${adminProjectDraftStatusLabels[latestDraft.reviewStatus]}。${latestDraft.previewTitle ? `当前标题为《${latestDraft.previewTitle}》。` : "当前还没有填写公开标题。"}`,
          tags: [
            `预告：${adminProjectDraftStatusLabels[latestDraft.previewStatus]}`,
            `审查：${adminProjectDraftStatusLabels[latestDraft.reviewStatus]}`,
          ],
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);
}
