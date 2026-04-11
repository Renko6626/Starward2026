import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  adminProjectDraftStatusLabels,
  type AdminProjectDraftListResponse,
} from "../../shared/admin";
import { SectionCard } from "../../app/components/SectionCard";
import { requestJson } from "../../app/lib/api";

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
        setState({ status: "error", message: error.message || "无法读取资料列表。" }),
      );
  }, []);

  return (
    <SectionCard
      eyebrow="后台 / 资料审阅"
      title="预告与审查资料"
      description="一期先把资料读取和状态查看做实，再决定是否拆成更细的后台页。"
    >
      {state.status === "loading" ? <p>正在读取资料列表。</p> : null}
      {state.status === "error" ? (
        <p className="inline-message inline-message--error">{state.message}</p>
      ) : null}
      {state.status === "ready" && state.payload.items.length === 0 ? (
        <div className="mini-card mini-card--compact">
          <strong>还没有草稿资料</strong>
          <p>当报名被批准时，会先自动创建空白 `project_drafts` 行；如已认领时间段，则通过 `segment_id` 关联当前排期。</p>
        </div>
      ) : null}
      {state.status === "ready" && state.payload.items.length > 0 ? (
        <div className="table-shell">
          <div className="table-shell__row table-shell__row--head">
            <span>参与者</span>
            <span>预告状态</span>
            <span>审查状态</span>
          </div>
          {state.payload.items.map((item) => (
            <div key={item.id} className="table-shell__row">
              <span>
                <strong>
                  <Link params={{ draftId: item.id }} to="/admin/project-drafts/$draftId">
                    {item.participantName}
                  </Link>
                </strong>
                <br />
                <small>{item.previewTitle ?? "尚无标题"}</small>
              </span>
              <span>{adminProjectDraftStatusLabels[item.previewStatus]}</span>
              <span>{adminProjectDraftStatusLabels[item.reviewStatus]}</span>
            </div>
          ))}
        </div>
      ) : null}
    </SectionCard>
  );
}
