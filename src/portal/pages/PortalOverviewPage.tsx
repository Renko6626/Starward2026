import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { SectionCard } from "../../app/components/SectionCard";
import { StatusBadge } from "../../app/components/StatusBadge";
import { ApiError, requestJson } from "../../app/lib/api";
import { formatDateTime } from "../../app/lib/format";
import type { PortalDashboardResponse } from "../../shared/portal";
import { buildWindowFlagMap } from "../../shared/windows";
import { authClient } from "../lib/auth-client";

export function PortalOverviewPage() {
  const navigate = useNavigate();
  const sessionQuery = authClient.useSession();
  const [dashboard, setDashboard] = useState<PortalDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!sessionQuery.isPending && !sessionQuery.data) {
      void navigate({ to: "/portal/login" });
      return;
    }

    if (!sessionQuery.data) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void requestJson<PortalDashboardResponse>("/api/portal/dashboard")
      .then((response) => {
        if (cancelled) {
          return;
        }

        setDashboard(response);
        setIsLoading(false);
      })
      .catch((caught) => {
        if (cancelled) {
          return;
        }

        if (caught instanceof ApiError && caught.status === 401) {
          void navigate({ to: "/portal/login" });
          return;
        }

        setError(caught instanceof Error ? caught.message : "参与者门户数据加载失败。");
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, sessionQuery.data, sessionQuery.isPending]);

  async function handleSignOut() {
    await authClient.signOut();
    void navigate({ to: "/portal/login" });
  }

  if (sessionQuery.isPending || isLoading) {
    return (
      <div className="page-stack">
        <div className="page-heading">
          <StatusBadge label="门户总览" />
          <h1>我的接力</h1>
          <p>正在加载参与者状态。</p>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="page-stack">
        <div className="page-heading">
          <StatusBadge label="门户总览" />
          <h1>我的接力</h1>
          <p>{error || "暂时无法读取参与者数据。"}</p>
        </div>
      </div>
    );
  }

  const windowFlags = buildWindowFlagMap(dashboard.windows);

  return (
    <div className="page-stack">
      <div className="page-heading">
        <StatusBadge label="门户总览" />
        <h1>我的接力</h1>
        <p>
          {dashboard.participant.displayName}，当前账号已绑定到参与者门户。
          这一页先回答你现在是谁、当前认领了哪个时间段、还缺什么资料，以及当前开放了哪些动作。
        </p>
      </div>

      <div className="route-grid">
        <div className="mini-card">
          <strong>参与资格</strong>
          <p>{dashboard.participant.status}</p>
        </div>
        <div className="mini-card">
          <strong>当前时间段</strong>
          <p>
            {dashboard.currentSegment
              ? `${dashboard.currentSegment.code} · ${dashboard.currentSegment.name}`
              : "尚未认领"}
          </p>
        </div>
        <div className="mini-card">
          <strong>预告资料</strong>
          <p>{dashboard.projectDraft?.previewStatus ?? "未开始"}</p>
        </div>
        <div className="mini-card">
          <strong>审查说明</strong>
          <p>{dashboard.projectDraft?.reviewStatus ?? "未开始"}</p>
        </div>
      </div>

      <SectionCard
        eyebrow="身份与入口"
        title="当前参与者身份"
        description="如果这里显示异常，就不是 UI 问题，而是需要主催处理参与者记录。"
        accent="blue"
      >
        <div className="detail-grid">
          <div className="mini-card mini-card--compact">
            <strong>绑定邮箱</strong>
            <p>{dashboard.user.email}</p>
          </div>
          <div className="mini-card mini-card--compact">
            <strong>显示名</strong>
            <p>{dashboard.participant.displayName}</p>
          </div>
          <div className="mini-card mini-card--compact">
            <strong>当前时间段</strong>
            <p>{dashboard.participant.currentSegmentCode ?? "未认领"}</p>
          </div>
          <div className="mini-card mini-card--compact">
            <strong>激活时间</strong>
            <p>{dashboard.participant.activatedAt ?? "本次会话前尚未激活"}</p>
          </div>
        </div>
        <div className="action-row">
          <Link className="button button--secondary" to="/portal/schedule">
            查看时间段认领与变更
          </Link>
          <Link className="button button--secondary" to="/portal/project">
            查看资料补录
          </Link>
          <Link className="button button--secondary" to="/portal/history">
            查看完整历史
          </Link>
          <button className="button button--secondary" onClick={() => void handleSignOut()} type="button">
            退出登录
          </button>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="总览页职责"
        title="这一页现在先回答 4 个问题"
        description="我当前认领了哪个时间段、我还缺什么资料、当前是否开放动作、下一步该去哪里。"
      >
        <ul className="plain-list">
          <li>先看状态，再给动作。</li>
          <li>每个动作都要受 `event_windows` 控制。</li>
          <li>一期不做很多薄页，优先把总览做成有效入口。</li>
        </ul>
      </SectionCard>

      <SectionCard
        eyebrow="当前窗口"
        title="主催开放了哪些动作"
        description="窗口关闭时，这些页仍可查看，但不应允许提交实际动作。"
      >
        <div className="detail-grid">
          <div className="mini-card mini-card--compact">
            <strong>时间段认领开放</strong>
            <p>{windowFlags.segmentClaimOpen ? "已开放" : "未开放"}</p>
          </div>
          <div className="mini-card mini-card--compact">
            <strong>时间段变更开放</strong>
            <p>{windowFlags.segmentChangeOpen ? "已开放" : "未开放"}</p>
          </div>
          <div className="mini-card mini-card--compact">
            <strong>预告提交开放</strong>
            <p>{windowFlags.previewSubmitOpen ? "已开放" : "未开放"}</p>
          </div>
          <div className="mini-card mini-card--compact">
            <strong>审查说明开放</strong>
            <p>{windowFlags.reviewSubmitOpen ? "已开放" : "未开放"}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="最近记录"
        title="近期参与者事件"
        description="这里只做最小审计视图，先让你知道系统记录到了什么。"
      >
        {dashboard.recentEvents.length > 0 ? (
          <div className="table-shell">
            {dashboard.recentEvents.map((event) => (
              <div className="table-shell__row" key={event.id}>
                <span>{event.label}</span>
                <span>{event.actorLabel}</span>
                <span>{formatDateTime(event.createdAt)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="inline-message">当前还没有记录到参与者事件。</p>
        )}
        <div className="action-row">
          <Link className="button button--secondary" to="/portal/history">
            查看完整历史
          </Link>
        </div>
        {error ? <p className="inline-message inline-message--error">{error}</p> : null}
      </SectionCard>
    </div>
  );
}
