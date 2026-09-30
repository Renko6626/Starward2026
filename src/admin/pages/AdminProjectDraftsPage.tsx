import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
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

  return (
    <div className="page-content">
      <PageHeading
        title={<>作品审核</>}
        description={
          <>集中查看参与者的预告资料与审查说明，并在详情页执行审核。</>
        }
      >
        {state.status === "ready" ? (
          <div className="text-sm font-mono text-on-surface-variant">
            草稿中 {progress.drafts} 份 · 已有正式提交 {progress.submitted}/{state.payload.items.length} 份
          </div>
        ) : null}
      </PageHeading>

      {state.status === "loading" ? (
        <StateNotice message="正在读取资料列表。" />
      ) : null}
      {state.status === "error" ? (
        <ReadError message={state.message} />
      ) : null}
      {state.status === "ready" && state.payload.items.length === 0 ? (
        <StateNotice message="还没有作品资料记录。审核通过后，创作者可以在这里填写作品资料。" />
      ) : null}

      {state.status === "ready" && state.payload.items.length > 0 ? (
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
                {state.payload.items.map((item) => (
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
                        to="/admin/project-drafts/$draftId"
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
