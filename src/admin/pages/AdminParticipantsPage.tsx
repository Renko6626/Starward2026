import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  adminParticipantStatusLabels,
  type AdminParticipantListResponse,
} from "../../shared/admin";
import { SectionCard } from "../../app/components/SectionCard";
import { requestJson } from "../../app/lib/api";

export function AdminParticipantsPage() {
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

  return (
    <SectionCard
      eyebrow="后台 / 参与者"
      title="参与者列表"
      description="这里会承接受邀邮箱、参与状态、首选联系方式和入口开放情况。"
    >
      {state.status === "loading" ? <p>正在读取参与者列表。</p> : null}
      {state.status === "error" ? (
        <p className="inline-message inline-message--error">{state.message}</p>
      ) : null}
      {state.status === "ready" && state.payload.items.length === 0 ? (
        <div className="mini-card mini-card--compact">
          <strong>还没有参与者</strong>
          <p>当主催批准报名后，这里会自动出现已转入的参与者。</p>
        </div>
      ) : null}
      {state.status === "ready" && state.payload.items.length > 0 ? (
        <div className="table-shell">
          <div className="table-shell__row table-shell__row--head">
            <span>参与者</span>
            <span>状态</span>
            <span>当前时间段</span>
          </div>
          {state.payload.items.map((item) => (
            <div key={item.id} className="table-shell__row">
              <span>
                <strong>
                  <Link params={{ participantId: item.id }} to="/admin/participants/$participantId">
                    {item.displayName}
                  </Link>
                </strong>
                <br />
                <small>{item.inviteEmail}</small>
              </span>
              <span>{adminParticipantStatusLabels[item.status]}</span>
              <span>{item.currentSegmentCode ?? "暂无"}</span>
            </div>
          ))}
        </div>
      ) : null}
    </SectionCard>
  );
}
