import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Search, XCircle } from "../../app/components/icons";
import { requestJson } from "../../app/lib/api";
import { formatDateTime } from "../../app/lib/format";
import { adminParticipantStatusLabels, type AdminParticipantListResponse } from "../../shared/admin";

export function AdminParticipantsPage() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; payload: AdminParticipantListResponse }
    | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    void requestJson<AdminParticipantListResponse>("/api/admin/participants")
      .then((payload) => setState({ status: "ready", payload }))
      .catch((error: Error) =>
        setState({ status: "error", message: error.message || "无法读取参与者列表。" }),
      );
  }, []);

  const items =
    state.status === "ready"
      ? state.payload.items.filter((item) =>
          [item.displayName, item.inviteEmail, item.currentSegmentCode ?? ""]
            .join("\n")
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
        )
      : [];

  const activeCount =
    state.status === "ready"
      ? state.payload.items.filter((item) => item.status === "approved" || item.status === "completed").length
      : 0;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 relative z-10 py-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-outline-variant pb-4">
        <div>
          <h1 className="text-2xl font-headline tracking-tight mb-1">参与者名册</h1>
          <p className="text-sm text-on-surface-variant">维护参与者邮箱、当前状态、时间段占用与后续管理入口。</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              className="w-64 bg-surface-variant border border-outline-variant rounded-md py-1.5 pl-9 pr-4 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-on-surface-variant/60"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索姓名、邮箱或时间段..."
              type="search"
              value={query}
            />
          </div>
        </div>
      </div>

      {state.status === "ready" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard label="总参与者数" value={String(state.payload.items.length)} />
          <MetricCard label="已批准 / 已完成" value={String(activeCount)} />
          <MetricCard label="当前搜索结果" value={String(items.length)} />
        </div>
      ) : null}

      {state.status === "loading" ? <StateNotice message="正在读取参与者列表。" /> : null}
      {state.status === "error" ? <StateNotice message={state.message} tone="error" /> : null}
      {state.status === "ready" && state.payload.items.length === 0 ? (
        <StateNotice message="还没有参与者。当主催批准报名后，这里会自动出现已转入的参与者记录。" />
      ) : null}
      {state.status === "ready" && state.payload.items.length > 0 && items.length === 0 ? (
        <StateNotice message="当前检索条件没有命中任何参与者。" />
      ) : null}

      {state.status === "ready" && items.length > 0 ? (
        <div className="bg-surface-container-low/50 border border-outline-variant rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-variant/50 border-b border-outline-variant text-on-surface-variant font-mono text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">参与者</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">当前时间段</th>
                  <th className="px-4 py-3 font-medium">最近更新</th>
                  <th className="px-4 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-variant/30 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="font-medium text-on-surface">{item.displayName}</div>
                      <div className="text-xs text-on-surface-variant">{item.inviteEmail}</div>
                      <div className="text-xs text-on-surface-variant">{item.contactHandle ?? "未填写联系备注"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <ParticipantStatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{item.currentSegmentCode ?? "暂无"}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{formatDateTime(item.updatedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        className="inline-flex min-h-10 items-center justify-center gap-2 px-3 py-1.5 bg-surface-variant border border-outline-variant rounded-md text-sm hover:bg-surface-bright transition-colors"
                        params={{ participantId: item.id }}
                        to="/admin/participants/$participantId"
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-lg border border-outline-variant bg-surface-container-low/80 backdrop-blur-sm">
      <h2 className="text-xs font-mono text-on-surface-variant mb-2 uppercase">{label}</h2>
      <div className="text-2xl font-bold tracking-tight text-on-surface">{value}</div>
    </div>
  );
}

function ParticipantStatusBadge({
  status,
}: {
  status: AdminParticipantListResponse["items"][number]["status"];
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

function StateNotice({ message, tone = "info" }: { message: string; tone?: "info" | "error" }) {
  return (
    <div
      className={
        tone === "error"
          ? "rounded-xl border border-error/40 bg-error/8 px-4 py-3 text-sm text-error"
          : "rounded-xl border border-outline-variant bg-surface-container-low/80 px-4 py-3 text-sm text-on-surface-variant"
      }
    >
      {message}
    </div>
  );
}
