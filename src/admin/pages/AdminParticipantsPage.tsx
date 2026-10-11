import { Link, getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ReadError, PageHeading, StateNotice, StatusBadge } from "../../app/components/ui";
import { requestJson } from "../../app/lib/api";
import { formatScheduledTime } from "../../app/lib/format";
import { cn } from "../../app/lib/cn";
import { adminParticipantStatusLabels, type AdminParticipantListResponse, type AdminProjectDraftListResponse, type AdminSegmentListResponse } from "../../shared/admin";
import { applicationInterestFormatLabels, applicationStatusLabels, type AdminApplicationListResponse } from "../../shared/applications";
import { buildCreatorRows, filterCreatorRows } from "../lib/creator-list";

type Payload = { participants: AdminParticipantListResponse["items"]; applications: AdminApplicationListResponse["items"]; segments: AdminSegmentListResponse["items"]; drafts: AdminProjectDraftListResponse["items"] };

export function AdminParticipantsPage() {
  const { view } = getRouteApi("/portal_/admin/participants/").useSearch();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<{ status: "loading" } | { status: "error"; message: string } | { status: "ready"; payload: Payload }>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      requestJson<AdminParticipantListResponse>("/api/admin/participants"),
      requestJson<AdminApplicationListResponse>("/api/admin/applications"),
      requestJson<AdminSegmentListResponse>("/api/admin/segments"),
      requestJson<AdminProjectDraftListResponse>("/api/admin/project-drafts"),
    ]).then(([participants, applications, segments, drafts]) => {
      if (!cancelled) setState({ status: "ready", payload: { participants: participants.items, applications: applications.items, segments: segments.items, drafts: drafts.items } });
    }).catch((error: Error) => { if (!cancelled) setState({ status: "error", message: error.message || "无法读取参与者列表。" }); });
    return () => { cancelled = true; };
  }, []);
  const rows = state.status === "ready" ? buildCreatorRows(state.payload.participants, state.payload.applications) : [];
  const pending = rows.filter(row => row.application?.status === "pending").length;
  const items = filterCreatorRows(rows, view, query);
  const reviewCount = state.status === "ready" ? state.payload.drafts.filter(item => item.previewStatus === "submitted" || item.reviewStatus === "submitted").length : 0;
  return <div className="page-content">
    <PageHeading title="参与者管理">
      <input className="field-input search-input" type="search" aria-label="搜索参与者" placeholder="搜索姓名、邮箱、联系方式或时点" value={query} onChange={event => setQuery(event.target.value)} />
    </PageHeading>
    {state.status === "ready" ? <div className="admin-work-summary">
      <span>待审核报名 <strong>{pending}</strong></span>
      <Link to="/portal/admin/project-drafts">待审核作品 <strong>{reviewCount}</strong></Link>
      <Link to="/portal/admin/participants" search={{ view: "unassigned" }}>尚未分配时点的已通过创作者 <strong>{state.payload.participants.filter(item => item.status === "approved" && !item.currentSegmentCode).length}</strong></Link>
    </div> : null}
    <nav className="flex flex-wrap gap-2" aria-label="参与者筛选">
      {["pending", "unassigned", "all"].map(value => <Link key={value} to="/portal/admin/participants" search={{ view: value as "pending" | "unassigned" | "all" }} aria-current={view === value ? "page" : undefined} className={cn("button button--secondary", view === value && "bg-primary/10 text-primary border-primary/30")}>{value === "unassigned" ? "已通过待安排" : value === "pending" ? `待审核 (${pending})` : `全部创作者 (${rows.length})`}</Link>)}
    </nav>
    {state.status === "loading" ? <StateNotice message="正在读取参与者列表。" /> : null}
    {state.status === "error" ? <ReadError message={state.message} /> : null}
    {state.status === "ready" && !items.length ? <StateNotice message={query ? "没有匹配的参与者，请调整搜索词。" : view === "pending" ? "当前没有待审核报名。全部创作者中可查看未报名账号及已处理记录。" : "当前还没有创作者记录。"} /> : null}
    {items.length ? <div className="table-frame"><div className="table-scroll" role="region" tabIndex={0} aria-label="参与者列表">
      <table className="data-table admin-compact-table admin-creators-table"><thead><tr><th>创作者</th><th>参加形式</th><th>发布时点</th><th>状态</th><th>操作</th></tr></thead><tbody>
        {items.map(({ key, participant, application }) => {
          const segment = state.status === "ready" && participant ? state.payload.segments.find(item => item.currentParticipantId === participant.id) : undefined;
          return <tr key={key}><td><div className="font-medium">{participant?.displayName ?? application?.displayName}</div><div className="text-sm text-on-surface-variant">{participant?.inviteEmail ?? application?.contactEmail ?? "未设置登录邮箱"}</div><div className="text-sm text-on-surface-variant">{participant?.contactHandle ?? application?.contactHandle ?? "未填写联系方式"}</div></td>
            <td><span className="mobile-field-label">参加形式</span>{application ? applicationInterestFormatLabels[application.interestFormat] : "尚未报名"}</td>
            <td><span className="mobile-field-label">发布时点</span>{segment ? <>{segment.code}<div className="text-sm text-on-surface-variant">{formatScheduledTime(segment.scheduledAt)}</div></> : participant?.currentSegmentCode ?? "待主催安排"}</td>
            <td><StatusBadge>{application ? applicationStatusLabels[application.status] : "未提交报名"}</StatusBadge>{participant && (participant.status === "completed" || (application?.status === "approved" && participant.status !== "approved")) ? <div className="text-sm text-on-surface-variant">参与资格：{adminParticipantStatusLabels[participant.status]}</div> : null}</td>
            <td>{participant ? <Link className="button button--secondary" to="/portal/admin/participants/$participantId" params={{ participantId: participant.id }}>查看详情</Link> : application ? <Link className="button button--secondary" to="/portal/admin/applications/$applicationId" params={{ applicationId: application.id }}>查看详情</Link> : null}</td>
          </tr>;
        })}
      </tbody></table>
    </div></div> : null}
  </div>;
}
