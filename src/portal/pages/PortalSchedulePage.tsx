import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Notice,
  PageHeading,
  StatusBadge,
  SummaryCard,
} from "../../app/components/ui";
import { ApiError, requestJson } from "../../app/lib/api";
import { formatDateTime } from "../../app/lib/format";
import type {
  PortalAvailableSegmentListResponse,
  PortalCurrentSegmentResponse,
  PortalSegmentMutationResponse,
  PortalSegmentSummary,
} from "../../shared/portal";
import { getWindowLabel } from "../../shared/windows";
import { authClient } from "../lib/auth-client";

type SchedulePageState =
  | { status: "loading" }
  | {
      status: "ready";
      schedule: PortalCurrentSegmentResponse;
      availableSegments: PortalAvailableSegmentListResponse["items"];
    }
  | { status: "error"; message: string };

const segmentStatusLabels = {
  open: "可认领",
  held: "已认领",
  locked: "锁定",
  released: "已释放",
  completed: "已完成",
} as const;

export function PortalSchedulePage() {
  const navigate = useNavigate();
  const sessionQuery = authClient.useSession();
  const [state, setState] = useState<SchedulePageState>({ status: "loading" });
  const [notice, setNotice] = useState<string | null>(null);
  const [submittingKey, setSubmittingKey] = useState<string | "release" | null>(
    null,
  );

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
        requestJson<PortalCurrentSegmentResponse>(
          "/api/portal/segments/current",
        ),
        requestJson<PortalAvailableSegmentListResponse>(
          "/api/portal/segments/available",
        ),
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
        message:
          caught instanceof Error ? caught.message : "无法读取当前时间段数据。",
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
      const response = await requestJson<PortalSegmentMutationResponse>(
        endpoint,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ segmentId }),
        },
      );

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
      <PageHeading
        title={<>日程安排</>}
        description={<>正在读取当前时间段状态。</>}
      ></PageHeading>
    );
  }

  if (state.status === "error") {
    return (
      <PageHeading
        title={<>日程安排</>}
        description={<>{state.message}</>}
      ></PageHeading>
    );
  }

  const modeLabel = state.schedule.currentSegment
    ? "变更 / 释放时间段"
    : "初次认领";
  const trackSegments: PortalSegmentSummary[] = [...state.availableSegments];
  if (
    state.schedule.currentSegment &&
    !trackSegments.some((segment) => segment.id === state.schedule.currentSegment?.id)
  ) {
    trackSegments.push(state.schedule.currentSegment);
  }
  trackSegments.sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="page-content">
      <PageHeading
        title={<>日程安排</>}
        description={
          <>
            {state.schedule.participant.displayName}
            ，这里会展示你当前持有的时间段，以及当前还能执行的认领、改坑和释放动作。
          </>
        }
      >
        <StatusBadge
          tone={state.schedule.currentSegment ? "success" : "warning"}
        >
          {modeLabel}
        </StatusBadge>
      </PageHeading>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard label="当前模式" value={modeLabel} />
        <SummaryCard
          label="时间段认领"
          value={getWindowLabel(state.schedule.windows, "segment_claim_open")}
        />
        <SummaryCard
          label="变更 / 释放"
          value={getWindowLabel(state.schedule.windows, "segment_change_open")}
        />
        <SummaryCard
          label="可选时间段数量"
          value={String(state.availableSegments.length)}
        />
      </div>

      <section className="panel schedule-constellation">
        <div>
          <p className="eyebrow">RELAY / STAR TRACK</p>
          <h2 className="text-xl font-medium text-on-surface mt-2">接力星轨</h2>
          <p className="text-base text-on-surface-variant mt-2">
            按接力顺序查看当前时间段状态，操作仍在下方候选列表中完成。
          </p>
        </div>
        {trackSegments.length ? (
          <ol className="schedule-track" aria-label="接力时间段状态">
            {trackSegments.map((segment) => {
              const isCurrent = state.schedule.currentSegment?.id === segment.id;
              return (
                <li
                  className={`schedule-track-item schedule-track-item--${segment.status} ${isCurrent ? "is-current" : ""}`}
                  key={segment.id}
                >
                  <span className="schedule-track-node" aria-hidden="true" />
                  <div>
                    <span className="schedule-track-code">{segment.code}</span>
                    <strong>{segment.name}</strong>
                    <span>{segmentStatusLabels[segment.status]}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <Notice>暂时没有可展示的时间段。</Notice>
        )}
      </section>

      <section className="panel space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h2 className="text-base font-mono text-on-surface-variant uppercase mb-2">
              {state.schedule.currentSegment
                ? "当前持有时间段"
                : "你目前还没有认领时间段"}
            </h2>
            <p className="text-base text-on-surface-variant">
              先看自己当前认领了哪一段，再决定是继续持有、切换到别的时间段，还是释放。
            </p>
          </div>
          {state.schedule.currentSegment ? (
            <StatusBadge
              tone={resolveSegmentTone(state.schedule.currentSegment.status)}
            >
              {segmentStatusLabels[state.schedule.currentSegment.status]}
            </StatusBadge>
          ) : null}
        </div>

        {state.schedule.currentSegment ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryCard
              label="编号"
              value={state.schedule.currentSegment.code}
            />
            <SummaryCard
              label="名称"
              value={state.schedule.currentSegment.name}
            />
            <SummaryCard
              label="认领时间"
              value={formatDateTime(state.schedule.currentSegment.claimedAt)}
            />
            <SummaryCard
              label="状态"
              value={segmentStatusLabels[state.schedule.currentSegment.status]}
            />
          </div>
        ) : (
          <Notice>{state.schedule.actions.claimHint}</Notice>
        )}

        {state.schedule.currentSegment?.description ? (
          <Notice>{state.schedule.currentSegment.description}</Notice>
        ) : null}

        {state.schedule.currentSegment ? (
          <div className="flex flex-wrap gap-3 pt-4 border-t border-outline-variant">
            <button
              className="px-6 py-2 bg-error/10 text-error border border-error/30 rounded-md font-medium hover:bg-error/20 transition-colors disabled:opacity-50"
              disabled={
                !state.schedule.actions.canRelease || submittingKey !== null
              }
              onClick={() => void handleRelease()}
              type="button"
            >
              {submittingKey === "release" ? "处理中..." : "释放当前时间段"}
            </button>
          </div>
        ) : null}
      </section>

      <section className="panel space-y-6">
        <div>
          <h2 className="text-base font-mono text-on-surface-variant uppercase mb-2">
            可选时间段
          </h2>
          <p className="text-base text-on-surface-variant">
            候选列表展示当前可以认领或切换到的时间段。
          </p>
        </div>

        {state.availableSegments.length === 0 ? (
          <Notice>
            当前没有空闲时间段。如果需要调整，可能要等主催开放更多时间段或有人释放时间段。
          </Notice>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {state.availableSegments.map((segment) => {
              const buttonDisabled = state.schedule.currentSegment
                ? !state.schedule.actions.canChange || submittingKey !== null
                : !state.schedule.actions.canClaim || submittingKey !== null;

              return (
                <div
                  className="p-5 border border-outline-variant bg-surface-variant/40 rounded-xl"
                  key={segment.id}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-on-surface">
                        {segment.code} · {segment.name}
                      </h3>
                      <p className="mt-1 text-base text-on-surface-variant">
                        {segment.description ?? "当前没有补充说明。"}
                      </p>
                    </div>
                    <StatusBadge tone={resolveSegmentTone(segment.status)}>
                      {segmentStatusLabels[segment.status]}
                    </StatusBadge>
                  </div>

                  <button
                    className="w-full px-4 py-2 bg-primary text-on-primary rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    disabled={buttonDisabled}
                    onClick={() => void handleSegmentMutation(segment.id)}
                    type="button"
                  >
                    {submittingKey === segment.id
                      ? "处理中..."
                      : state.schedule.currentSegment
                        ? "改为这一段"
                        : "认领这一段"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel space-y-3">
        <h2 className="text-base font-mono text-on-surface-variant uppercase">
          动作说明
        </h2>
        <p className="text-base text-on-surface-variant leading-7">
          {state.schedule.actions.claimHint}
        </p>
        <p className="text-base text-on-surface-variant leading-7">
          {state.schedule.actions.changeHint}
        </p>
        <p className="text-base text-on-surface-variant leading-7">
          {state.schedule.actions.releaseHint}
        </p>
      </section>

      {notice ? <Notice tone="success">{notice}</Notice> : null}
    </div>
  );
}

function resolveSegmentTone(
  status: keyof typeof segmentStatusLabels,
): "muted" | "warning" | "success" {
  if (status === "held" || status === "completed") {
    return "success";
  }

  if (status === "locked") {
    return "warning";
  }

  return "muted";
}
