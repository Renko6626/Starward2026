import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Filter, Search, XCircle } from "../../app/components/icons";
import { requestJson } from "../../app/lib/api";
import { cn } from "../../app/lib/cn";
import { formatDateTime } from "../../app/lib/format";
import {
  applicationInterestFormatLabels,
  applicationStatusLabels,
  type AdminApplicationListResponse,
  type ApplicationStatus,
} from "../../shared/applications";
import { resolveApplicationDisplayName } from "../../shared/application-identity";
import { participantPortalStatusLabels } from "../../shared/portal";
import {
  buildAdminApplicationFilterCounts,
  filterAdminApplications,
  type AdminApplicationFilter,
} from "../lib/application-list";

const filterLabels: Record<AdminApplicationFilter, string> = {
  all: "全部",
  pending: "待审核",
  "needs-entry": "未绑入口",
  "needs-profile": "待补资料",
  converted: "已转参与者",
};

export function AdminApplicationsPage() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; payload: AdminApplicationListResponse }
    | { status: "error"; message: string }
  >({ status: "loading" });
  const [activeFilter, setActiveFilter] = useState<AdminApplicationFilter>("pending");
  const [query, setQuery] = useState("");

  useEffect(() => {
    void requestJson<AdminApplicationListResponse>("/api/admin/applications")
      .then((payload) => setState({ status: "ready", payload }))
      .catch((error: Error) =>
        setState({ status: "error", message: error.message || "无法读取报名列表。" }),
      );
  }, []);

  const counts = state.status === "ready" ? buildAdminApplicationFilterCounts(state.payload.items) : null;
  const items =
    state.status === "ready"
      ? filterAdminApplications(state.payload.items, {
          filter: activeFilter,
          query,
        })
      : [];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 relative z-10 py-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-outline-variant pb-4">
        <div>
          <h1 className="text-2xl font-headline tracking-tight mb-1">报名审核队列</h1>
          <p className="text-sm text-on-surface-variant">管理与审核创作者正式报名，并识别未绑入口、待补资料或尚未开放资格的账号。</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              className="w-64 bg-surface-variant border border-outline-variant rounded-md py-1.5 pl-9 pr-4 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-on-surface-variant/60"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索姓名、邮箱或参与者 ID..."
              type="search"
              value={query}
            />
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-surface-variant border border-outline-variant rounded-md text-sm text-on-surface-variant">
            <Filter className="w-4 h-4" />
            当前筛选
          </div>
        </div>
      </div>

      {counts ? (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(filterLabels) as AdminApplicationFilter[]).map((filterKey) => (
            <button
              key={filterKey}
              className={cn(
                "inline-flex min-h-10 items-center rounded-md border px-3 py-2 text-sm transition-colors",
                activeFilter === filterKey
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-surface-variant text-on-surface-variant border-outline-variant hover:bg-surface-bright",
              )}
              onClick={() => setActiveFilter(filterKey)}
              type="button"
            >
              {filterLabels[filterKey]} ({counts[filterKey]})
            </button>
          ))}
        </div>
      ) : null}

      {state.status === "loading" ? <StateNotice message="正在读取报名列表。" /> : null}
      {state.status === "error" ? <StateNotice message={state.message} tone="error" /> : null}
      {state.status === "ready" && state.payload.items.length === 0 ? (
        <StateNotice message="还没有正式报名记录。待参与者完成入口登录、资料补充与报名提交后，这里才会出现队列。" />
      ) : null}
      {state.status === "ready" && state.payload.items.length > 0 && items.length === 0 ? (
        <StateNotice message="当前筛选下没有匹配记录。可以切换筛选条件，或清空检索词后重新查看。" />
      ) : null}

      {state.status === "ready" && items.length > 0 ? (
        <div className="bg-surface-container-low/50 border border-outline-variant rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-variant/50 border-b border-outline-variant text-on-surface-variant font-mono text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">申请人</th>
                  <th className="px-4 py-3 font-medium">格式</th>
                  <th className="px-4 py-3 font-medium">提交时间</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50">
                {items.map((application) => (
                  <tr key={application.id} className="hover:bg-surface-variant/30 transition-colors group">
                    <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{application.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-on-surface">
                        {resolveApplicationDisplayName({
                          displayName: application.displayName,
                          contactHandle: application.contactHandle,
                          contactEmail: application.contactEmail,
                        })}
                      </div>
                      <div className="text-xs text-on-surface-variant">{application.contactEmail}</div>
                      <div className="text-xs text-on-surface-variant">
                        {application.authUserEmail ? `入口 ${application.authUserEmail}` : "未建立入口账号"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      <div>{applicationInterestFormatLabels[application.interestFormat]}</div>
                      <div className="text-xs">
                        {application.hasPortalProfile ? "联系资料已补齐" : "联系资料待补充"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{formatDateTime(application.createdAt)}</td>
                    <td className="px-4 py-3">
                      <ApplicationStatusBadge status={application.status} />
                      <div className="mt-2 text-xs text-on-surface-variant">
                        {application.participantId && application.participantStatus
                          ? `工作台：${participantPortalStatusLabels[application.participantStatus]}`
                          : "尚未建立工作台"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        className="inline-flex min-h-10 items-center justify-center gap-2 px-3 py-1.5 bg-surface-variant border border-outline-variant rounded-md text-sm hover:bg-surface-bright transition-colors"
                        params={{ applicationId: application.id }}
                        to="/admin/applications/$applicationId"
                      >
                        查看详情
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  switch (status) {
    case "approved":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary border border-tertiary/20 text-xs font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" /> {applicationStatusLabels[status]}
        </span>
      );
    case "rejected":
    case "withdrawn":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-error/10 text-error border border-error/20 text-xs font-medium">
          <XCircle className="w-3.5 h-3.5" /> {applicationStatusLabels[status]}
        </span>
      );
    case "pending":
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-medium">
          <Clock className="w-3.5 h-3.5" /> {applicationStatusLabels[status]}
        </span>
      );
  }
}

function StateNotice({ message, tone = "info" }: { message: string; tone?: "info" | "error" }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        tone === "error"
          ? "border-error/40 bg-error/8 text-error"
          : "border-outline-variant bg-surface-container-low/80 text-on-surface-variant",
      )}
    >
      {message}
    </div>
  );
}
