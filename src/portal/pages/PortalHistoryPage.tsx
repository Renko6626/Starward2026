import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { SectionCard } from "../../app/components/SectionCard";
import { StatusBadge } from "../../app/components/StatusBadge";
import { ApiError, requestJson } from "../../app/lib/api";
import { formatDateTime } from "../../app/lib/format";
import type { PortalHistoryResponse } from "../../shared/portal";
import { authClient } from "../lib/auth-client";

type HistoryPageState =
  | { status: "loading" }
  | { status: "ready"; history: PortalHistoryResponse }
  | { status: "error"; message: string };

export function PortalHistoryPage() {
  const navigate = useNavigate();
  const sessionQuery = authClient.useSession();
  const [state, setState] = useState<HistoryPageState>({ status: "loading" });

  useEffect(() => {
    if (!sessionQuery.isPending && !sessionQuery.data) {
      void navigate({ to: "/portal/login" });
      return;
    }

    if (!sessionQuery.data) {
      return;
    }

    void loadHistoryPage();
  }, [navigate, sessionQuery.data, sessionQuery.isPending]);

  async function loadHistoryPage() {
    setState({ status: "loading" });

    try {
      const history = await requestJson<PortalHistoryResponse>("/api/portal/history");
      setState({ status: "ready", history });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        void navigate({ to: "/portal/login" });
        return;
      }

      setState({
        status: "error",
        message: caught instanceof Error ? caught.message : "无法读取参与者历史记录。",
      });
    }
  }

  if (sessionQuery.isPending || state.status === "loading") {
    return (
      <div className="page-stack">
        <div className="page-heading">
          <StatusBadge label="门户 / 历史记录" />
          <h1>操作历史</h1>
          <p>正在读取参与者历史记录。</p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="page-stack">
        <div className="page-heading">
          <StatusBadge label="门户 / 历史记录" />
          <h1>操作历史</h1>
          <p>{state.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <StatusBadge label="门户 / 历史记录" />
        <h1>操作历史</h1>
        <p>
          {state.history.participant.displayName}，这一页会把参与者可见的关键动作按时间倒序列出来，
          方便你确认系统记录到了什么，也方便和主催对齐状态。
        </p>
      </div>

      <SectionCard
        eyebrow="可见审计"
        title="近期系统记录"
        description="一期先保留参与者可见的轻量审计历史，不做复杂筛选。"
      >
        {state.history.items.length > 0 ? (
          <div className="table-shell">
            {state.history.items.map((item) => (
              <div className="table-shell__row" key={item.id}>
                <span>{item.label}</span>
                <span>{item.actorLabel}</span>
                <span>{formatDateTime(item.createdAt)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="inline-message">当前还没有可显示的参与者历史记录。</p>
        )}
        <div className="action-row">
          <Link className="button button--secondary" to="/portal">
            返回门户总览
          </Link>
          <Link className="button button--secondary" to="/portal/project">
            前往资料补录
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
