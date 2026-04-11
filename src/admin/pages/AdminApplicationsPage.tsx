import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  applicationInterestFormatLabels,
  applicationStatusLabels,
  type AdminApplicationListResponse,
} from "../../shared/applications";
import { SectionCard } from "../../app/components/SectionCard";
import { requestJson } from "../../app/lib/api";

export function AdminApplicationsPage() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; payload: AdminApplicationListResponse }
    | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    void requestJson<AdminApplicationListResponse>("/api/admin/applications")
      .then((payload) => setState({ status: "ready", payload }))
      .catch((error: Error) =>
        setState({ status: "error", message: error.message || "无法读取报名列表。" }),
      );
  }, []);

  return (
    <SectionCard
      eyebrow="后台 / 报名列表"
      title="报名审核入口"
      description="现在已经接到真实 API。下一步可以继续补搜索、状态筛选和批量动作。"
    >
      {state.status === "loading" ? <p>正在读取报名列表。</p> : null}
      {state.status === "error" ? (
        <p className="inline-message inline-message--error">{state.message}</p>
      ) : null}
      {state.status === "ready" && state.payload.items.length === 0 ? (
        <div className="mini-card mini-card--compact">
          <strong>还没有报名记录</strong>
          <p>等公开报名开放并有人提交后，这里会出现第一批待审核条目。</p>
        </div>
      ) : null}
      {state.status === "ready" && state.payload.items.length > 0 ? (
        <div className="table-shell">
        <div className="table-shell__row table-shell__row--head">
          <span>报名人</span>
          <span>状态与形式</span>
          <span>操作</span>
        </div>
        {state.payload.items.map((application) => (
          <div key={application.id} className="table-shell__row">
            <span>
              <strong>{application.displayName}</strong>
              <br />
              <small>{application.contactEmail}</small>
            </span>
            <span>
              <strong>{applicationStatusLabels[application.status]}</strong>
              <br />
              <small>{applicationInterestFormatLabels[application.interestFormat]}</small>
            </span>
            <span>
              <Link
                params={{ applicationId: application.id }}
                to="/admin/applications/$applicationId"
              >
                查看详情
              </Link>
            </span>
          </div>
        ))}
        </div>
      ) : null}
    </SectionCard>
  );
}
