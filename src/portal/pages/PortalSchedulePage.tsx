import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SectionCard } from "../../app/components/SectionCard";
import { StatusBadge } from "../../app/components/StatusBadge";
import { ApiError, requestJson } from "../../app/lib/api";
import { formatDateTime } from "../../app/lib/format";
import type {
  PortalAvailableSegmentListResponse,
  PortalCurrentSegmentResponse,
  PortalSegmentMutationResponse,
} from "../../shared/portal";
import { buildWindowFlagMap } from "../../shared/windows";
import { authClient } from "../lib/auth-client";

type SchedulePageState =
  | { status: "loading" }
  | {
      status: "ready";
      schedule: PortalCurrentSegmentResponse;
      availableSegments: PortalAvailableSegmentListResponse["items"];
    }
  | { status: "error"; message: string };

export function PortalSchedulePage() {
  const navigate = useNavigate();
  const sessionQuery = authClient.useSession();
  const [state, setState] = useState<SchedulePageState>({ status: "loading" });
  const [notice, setNotice] = useState<string | null>(null);
  const [submittingKey, setSubmittingKey] = useState<string | "release" | null>(null);

  useEffect(() => {
    if (!sessionQuery.isPending && !sessionQuery.data) {
      void navigate({ to: "/portal/login" });
      return;
    }

    if (!sessionQuery.data) {
      return;
    }

    void loadSchedulePage();
  }, [navigate, sessionQuery.data, sessionQuery.isPending]);

  async function loadSchedulePage() {
    setState({ status: "loading" });

    try {
      const [schedule, available] = await Promise.all([
        requestJson<PortalCurrentSegmentResponse>("/api/portal/segments/current"),
        requestJson<PortalAvailableSegmentListResponse>("/api/portal/segments/available"),
      ]);

      setState({
        status: "ready",
        schedule,
        availableSegments: available.items,
      });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        void navigate({ to: "/portal/login" });
        return;
      }

      setState({
        status: "error",
        message: caught instanceof Error ? caught.message : "无法读取当前时间段数据。",
      });
    }
  }

  async function handleSegmentMutation(segmentId: string) {
    if (state.status !== "ready") {
      return;
    }

    const endpoint = state.schedule.currentSegment
      ? "/api/portal/segments/change"
      : "/api/portal/segments/claim";
    setSubmittingKey(segmentId);
    setNotice(null);

    try {
      const response = await requestJson<PortalSegmentMutationResponse>(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ segmentId }),
      });

      setNotice(response.message);
      await loadSchedulePage();
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "时间段操作失败。");
    } finally {
      setSubmittingKey(null);
    }
  }

  async function handleRelease() {
    setSubmittingKey("release");
    setNotice(null);

    try {
      const response = await requestJson<PortalSegmentMutationResponse>(
        "/api/portal/segments/release",
        {
          method: "POST",
        },
      );

      setNotice(response.message);
      await loadSchedulePage();
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "释放时间段失败。");
    } finally {
      setSubmittingKey(null);
    }
  }

  if (sessionQuery.isPending || state.status === "loading") {
    return (
      <div className="page-stack">
        <div className="page-heading">
          <StatusBadge label="门户 / 时间段" />
          <h1>当前时间段</h1>
          <p>正在读取当前时间段状态。</p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="page-stack">
        <div className="page-heading">
          <StatusBadge label="门户 / 时间段" />
          <h1>当前时间段</h1>
          <p>{state.message}</p>
        </div>
      </div>
    );
  }

  const windowFlags = buildWindowFlagMap(state.schedule.windows);
  const modeLabel = state.schedule.currentSegment ? "变更 / 释放时间段" : "初次认领";

  return (
    <div className="page-stack">
      <div className="page-heading">
        <StatusBadge label="门户 / 时间段" />
        <h1>当前时间段</h1>
        <p>
          {state.schedule.participant.displayName}，这里不是冷冰冰的数据库表，而是你在接力里的当前时间段工作台。
          先看自己当前认领了哪一段，再决定是继续认领、变更还是释放。
        </p>
      </div>

      <div className="route-grid">
        <div className="mini-card">
          <strong>当前模式</strong>
          <p>{modeLabel}</p>
        </div>
        <div className="mini-card">
          <strong>时间段认领开放</strong>
          <p>{windowFlags.segmentClaimOpen ? "已开放" : "未开放"}</p>
        </div>
        <div className="mini-card">
          <strong>时间段变更 / 释放开放</strong>
          <p>{windowFlags.segmentChangeOpen ? "已开放" : "未开放"}</p>
        </div>
        <div className="mini-card">
          <strong>可选时间段数量</strong>
          <p>{state.availableSegments.length}</p>
        </div>
      </div>

      <SectionCard
        eyebrow="当前持有状态"
        title={
          state.schedule.currentSegment
            ? `${state.schedule.currentSegment.code} · ${state.schedule.currentSegment.name}`
            : "你目前还没有认领时间段"
        }
        description="一期先把最关键的时间段状态和可执行动作做清楚，避免用户在多个薄页面之间来回跳。"
        accent="blue"
      >
        {state.schedule.currentSegment ? (
          <div className="detail-grid">
            <div className="mini-card mini-card--compact">
              <strong>当前状态</strong>
              <p>{state.schedule.currentSegment.status}</p>
            </div>
            <div className="mini-card mini-card--compact">
              <strong>认领时间</strong>
              <p>{formatDateTime(state.schedule.currentSegment.claimedAt)}</p>
            </div>
            <div className="mini-card mini-card--compact">
              <strong>变更提示</strong>
              <p>{state.schedule.actions.changeHint}</p>
            </div>
            <div className="mini-card mini-card--compact">
              <strong>释放提示</strong>
              <p>{state.schedule.actions.releaseHint}</p>
            </div>
          </div>
        ) : (
          <div className="mini-card mini-card--compact">
            <strong>尚未认领</strong>
            <p>{state.schedule.actions.claimHint}</p>
          </div>
        )}

        {state.schedule.currentSegment?.description ? (
          <div className="mini-card mini-card--compact">
            <strong>时间段说明</strong>
            <p>{state.schedule.currentSegment.description}</p>
          </div>
        ) : null}

        <div className="action-row">
          <button
            className="button button--danger"
            disabled={!state.schedule.actions.canRelease || submittingKey !== null}
            onClick={() => void handleRelease()}
            type="button"
          >
            {submittingKey === "release" ? "处理中" : "释放当前时间段"}
          </button>
        </div>

        {notice ? <p className="inline-message">{notice}</p> : null}
      </SectionCard>

      <SectionCard
        eyebrow="可选时间段"
        title="当前还能选择哪些时间段"
        description="小规模接力更适合卡片式列表。你只需要快速看清楚哪一段空着、自己现在能不能动。"
      >
        {state.availableSegments.length === 0 ? (
          <div className="mini-card mini-card--compact">
            <strong>当前没有空闲时间段</strong>
            <p>如果需要调整，可能要等主催开放更多时间段或有人释放当前时间段。</p>
          </div>
        ) : (
          <div className="route-grid">
            {state.availableSegments.map((segment) => {
              const buttonDisabled = state.schedule.currentSegment
                ? !state.schedule.actions.canChange || submittingKey !== null
                : !state.schedule.actions.canClaim || submittingKey !== null;

              return (
                <div className="mini-card" key={segment.id}>
                  <strong>
                    {segment.code} · {segment.name}
                  </strong>
                  <p>{segment.description ?? "当前没有补充说明。"}</p>
                  <p>状态：{segment.status}</p>
                  <div className="action-row">
                    <button
                      className="button button--primary"
                      disabled={buttonDisabled}
                      onClick={() => void handleSegmentMutation(segment.id)}
                      type="button"
                    >
                      {submittingKey === segment.id
                        ? "处理中"
                        : state.schedule.currentSegment
                          ? "改为这一段"
                          : "认领这一段"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        eyebrow="动作说明"
        title="当前系统会如何判断你能不能操作"
        description="前端只负责呈现，真正的时间段认领冲突判断仍在服务端完成。"
      >
        <ul className="plain-list">
          <li>{state.schedule.actions.claimHint}</li>
          <li>{state.schedule.actions.changeHint}</li>
          <li>{state.schedule.actions.releaseHint}</li>
          <li>如果你点下去时有人刚好先一步认领，服务端会拒绝并要求刷新。</li>
        </ul>
      </SectionCard>
    </div>
  );
}
