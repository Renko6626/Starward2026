import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Search,
  CheckCircle2,
  Clock,
  FileText,
  XCircle,
} from "../../app/components/icons";
import { ReadError, PageHeading, StateNotice } from "../../app/components/ui";
import { requestJson } from "../../app/lib/api";
import { summarizeProjectProgress } from "../lib/project-progress";
import {
  adminProjectDraftStatusLabels,
  type AdminProjectDraftListResponse,
} from "../../shared/admin";

export function AdminProjectDraftsPage() {
  const [query, setQuery] = useState("");
  const [pendingOnly, setPendingOnly] = useState(true);
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; payload: AdminProjectDraftListResponse }
    | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    void requestJson<AdminProjectDraftListResponse>("/api/admin/project-drafts")
      .then((payload) => setState({ status: "ready", payload }))
      .catch((error: Error) =>
        setState({
          status: "error",
          message: error.message || "无法读取资料列表。",
        }),
      );
  }, []);

  const progress = summarizeProjectProgress(
    state.status === "ready" ? state.payload.items : [],
  );

  const items = state.status === "ready" ? state.payload.items.filter(item =>
    (!pendingOnly || item.previewStatus === "submitted" || item.reviewStatus === "submitted") &&
    [item.participantName, item.previewTitle, item.segmentCode].join("\n").toLowerCase().includes(query.trim().toLowerCase()),
  ) : [];

  return (
    <div className="page-content">
      <PageHeading
        title={<>作品审核</>}
      >
        {state.status === "ready" ? (
          <div className="text-sm font-mono text-on-surface-variant">
            草稿中 {progress.drafts} 份；已有正式提交 {progress.submitted}/{state.payload.items.length} 份
          </div>
        ) : null}
      </PageHeading>

      <div className="flex flex-wrap items-center gap-3">
        <label className="checkbox-field"><input type="checkbox" checked={pendingOnly} onChange={event => setPendingOnly(event.target.checked)} />仅显示待审核</label>
        <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" /><input className="field-input search-input" aria-label="搜索作品" placeholder="搜索创作者、标题或时点" type="search" value={query} onChange={event => setQuery(event.target.value)} /></div>
      </div>
      {state.status === "ready" && state.payload.items.length > 0 && !items.length ? <StateNotice message="当前筛选下没有作品。可取消仅显示待审核，或调整搜索词。" /> : null}

      {state.status === "loading" ? (
        <StateNotice message="正在读取资料列表。" />
      ) : null}
      {state.status === "error" ? (
        <ReadError message={state.message} />
      ) : null}
      {state.status === "ready" && state.payload.items.length === 0 ? (
        <StateNotice message="还没有作品资料记录。审核通过后，创作者可以在这里填写作品资料。" />
      ) : null}

      {state.status === "ready" && items.length > 0 ? (
        <div className="table-frame">
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="数据列表"
          >
            <table className="data-table admin-compact-table admin-projects-table">
              <thead>
                <tr>
                  <th className="px-4 py-3 font-medium">参与者</th>
                  <th className="px-4 py-3 font-medium">预告状态</th>
                  <th className="px-4 py-3 font-medium">审查状态</th>
                  <th className="px-4 py-3 font-medium">当前标题</th>
                  <th className="px-4 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-surface-variant/30 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-on-surface">
                        {item.participantName}
                      </div>
                      <div className="text-sm text-on-surface-variant">
                        {item.segmentCode
                          ? `当前时间段 ${item.segmentCode}`
                          : "尚未分配时间段"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="mobile-field-label">预告</span>
                      <DraftStatusBadge status={item.previewStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="mobile-field-label">审查</span>
                      <DraftStatusBadge status={item.reviewStatus} />
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {item.previewTitle ?? "尚无标题"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        className="inline-flex min-h-10 items-center justify-center gap-2 px-3 py-1.5 bg-surface-variant border border-outline-variant rounded-md text-base hover:bg-surface-bright transition-colors"
                        params={{ draftId: item.id }}
                        to="/portal/admin/project-drafts/$draftId"
                      >
                        <FileText className="w-4 h-4" />
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

function DraftStatusBadge({
  status,
}: {
  status: AdminProjectDraftListResponse["items"][number]["previewStatus"];
}) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary border border-tertiary/20 text-sm font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" />{" "}
        {adminProjectDraftStatusLabels[status]}
      </span>
    );
  }

  if (status === "changes_requested") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-error/10 text-error border border-error/20 text-sm font-medium">
        <XCircle className="w-3.5 h-3.5" />{" "}
        {adminProjectDraftStatusLabels[status]}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-sm font-medium">
      <Clock className="w-3.5 h-3.5" /> {adminProjectDraftStatusLabels[status]}
    </span>
  );
}
