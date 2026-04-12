import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Clock, Clock3, UserRound } from "../../app/components/icons";
import { requestJson } from "../../app/lib/api";
import { cn } from "../../app/lib/cn";
import { formatDateTime } from "../../app/lib/format";
import {
  adminParticipantStatusLabels,
  adminSegmentStatusLabels,
  type AdminParticipantListResponse,
  type AdminSegmentBootstrapResponse,
  type AdminSegmentItem,
  type AdminSegmentListResponse,
  type AdminSegmentMutationResponse,
} from "../../shared/admin";

type SchedulePayload = {
  participants: AdminParticipantListResponse["items"];
  segments: AdminSegmentItem[];
};

type ScheduleState =
  | { status: "loading" }
  | { status: "ready"; payload: SchedulePayload }
  | { status: "error"; message: string };

type BootstrapState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type SegmentDraft = {
  description: string;
  status: AdminSegmentItem["status"];
  currentParticipantId: string;
};

type SegmentSaveState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function AdminSchedulePage() {
  const [state, setState] = useState<ScheduleState>({ status: "loading" });
  const [drafts, setDrafts] = useState<Record<string, SegmentDraft>>({});
  const [saveStates, setSaveStates] = useState<Record<string, SegmentSaveState>>({});
  const [bootstrapCount, setBootstrapCount] = useState("12");
  const [bootstrap, setBootstrap] = useState<BootstrapState>({ status: "idle" });

  useEffect(() => {
    void loadSchedulePage();
  }, []);

  async function loadSchedulePage() {
    setState({ status: "loading" });

    try {
      const [segmentPayload, participantPayload] = await Promise.all([
        requestJson<AdminSegmentListResponse>("/api/admin/segments"),
        requestJson<AdminParticipantListResponse>("/api/admin/participants"),
      ]);

      setDrafts(buildDraftMap(segmentPayload.items));
      setSaveStates({});
      setState({
        status: "ready",
        payload: {
          participants: participantPayload.items,
          segments: segmentPayload.items,
        },
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "无法读取时间段状态。",
      });
    }
  }

  function updateDraft(segmentId: string, patch: Partial<SegmentDraft>) {
    setDrafts((current) => ({
      ...current,
      [segmentId]: {
        ...(current[segmentId] ?? {
          description: "",
          status: "open",
          currentParticipantId: "",
        }),
        ...patch,
      },
    }));
    setSaveStates((current) => ({
      ...current,
      [segmentId]: { status: "idle" },
    }));
  }

  async function handleBootstrap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBootstrap({ status: "idle" });

    const count = Number(bootstrapCount);

    if (!Number.isInteger(count) || count < 1 || count > 120) {
      setBootstrap({
        status: "error",
        message: "初始化数量必须是 1 到 120 之间的整数。",
      });
      return;
    }

    setBootstrap({ status: "submitting" });

    try {
      const payload = await requestJson<AdminSegmentBootstrapResponse>("/api/admin/segments/bootstrap", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ count }),
      });

      setDrafts(buildDraftMap(payload.items));
      setState((current) =>
        current.status === "ready"
          ? {
              status: "ready",
              payload: {
                ...current.payload,
                segments: payload.items,
              },
            }
          : current,
      );
      setBootstrap({ status: "success", message: payload.message });
    } catch (error) {
      setBootstrap({
        status: "error",
        message: error instanceof Error ? error.message : "初始化时间段失败。",
      });
    }
  }

  async function handleSegmentSave(event: FormEvent<HTMLFormElement>, segmentId: string) {
    event.preventDefault();
    const draft = drafts[segmentId];

    if (!draft) {
      return;
    }

    setSaveStates((current) => ({
      ...current,
      [segmentId]: { status: "submitting" },
    }));

    try {
      const payload = await requestJson<AdminSegmentMutationResponse>(`/api/admin/segments/${segmentId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          description: draft.description,
          status: draft.status,
          currentParticipantId: draft.status === "held" ? draft.currentParticipantId || null : null,
        }),
      });

      setDrafts((current) => ({
        ...current,
        [segmentId]: buildDraft(payload.item),
      }));
      setSaveStates((current) => ({
        ...current,
        [segmentId]: {
          status: "success",
          message: payload.message,
        },
      }));
      setState((current) =>
        current.status === "ready"
          ? {
              status: "ready",
              payload: {
                ...current.payload,
                segments: current.payload.segments.map((segment) =>
                  segment.id === payload.item.id ? payload.item : segment,
                ),
              },
            }
          : current,
      );
    } catch (error) {
      setSaveStates((current) => ({
        ...current,
        [segmentId]: {
          status: "error",
          message: error instanceof Error ? error.message : "时间段更新失败。",
        },
      }));
    }
  }

  const segmentMetrics =
    state.status === "ready"
      ? {
          total: state.payload.segments.length,
          open: state.payload.segments.filter((item) => item.status === "open").length,
          held: state.payload.segments.filter((item) => item.status === "held").length,
          completed: state.payload.segments.filter((item) => item.status === "completed").length,
        }
      : null;

  return (
    <div className="max-w-7xl mx-auto space-y-6 relative z-10 py-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-outline-variant pb-4">
        <div>
          <h1 className="text-2xl font-headline tracking-tight mb-1">全局日程</h1>
          <p className="text-sm text-on-surface-variant">查看时间段初始化状态、当前占用情况，并手动修正单个时间段。</p>
        </div>
        {segmentMetrics ? (
          <div className="text-xs font-mono text-on-surface-variant">
            当前共 {segmentMetrics.total} 个时间段
          </div>
        ) : null}
      </div>

      {segmentMetrics ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard label="总时间段" value={String(segmentMetrics.total)} />
          <MetricCard label="可认领" value={String(segmentMetrics.open)} />
          <MetricCard label="已认领" value={String(segmentMetrics.held)} />
          <MetricCard label="已完成" value={String(segmentMetrics.completed)} />
        </div>
      ) : null}

      {state.status === "loading" ? <StateNotice message="正在读取时间段状态。" /> : null}
      {state.status === "error" ? <StateNotice message={state.message} tone="error" /> : null}
      {bootstrap.status === "success" ? <StateNotice message={bootstrap.message} tone="success" /> : null}

      {state.status === "ready" && state.payload.segments.length === 0 ? (
        <section className="p-6 border border-outline-variant bg-surface-container-low/50 rounded-xl space-y-6">
          <div className="border-b border-outline-variant pb-4">
            <h2 className="text-sm font-mono text-on-surface-variant uppercase">初始化时间段</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              当前还没有时间段记录。先写入一期初始数量，后续再在同页进行人工修正。
            </p>
          </div>

          <form className="max-w-sm space-y-4" onSubmit={handleBootstrap}>
            <FormField label="初始时间段数量">
              <input
                className="w-full bg-surface-variant border border-outline-variant rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                inputMode="numeric"
                max={120}
                min={1}
                onChange={(event) => setBootstrapCount(event.target.value)}
                type="number"
                value={bootstrapCount}
              />
            </FormField>
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-md hover:bg-primary/90 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={bootstrap.status === "submitting"}
              type="submit"
            >
              {bootstrap.status === "submitting" ? "正在初始化..." : "初始化时间段"}
            </button>
            {bootstrap.status === "error" ? <StateNotice message={bootstrap.message} tone="error" /> : null}
          </form>
        </section>
      ) : null}

      {state.status === "ready" && state.payload.segments.length > 0 ? (
        <section className="space-y-4">
          <div className="rounded-xl border border-outline-variant bg-surface-container-low/80 p-4 text-sm text-on-surface-variant">
            如果把某位参与者改到新的 `held` 时间段，系统会自动释放其原先持有的时间段，并同步 `project_drafts.segment_id`。
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {state.payload.segments.map((segment) => {
              const draft = drafts[segment.id] ?? buildDraft(segment);
              const saveState = saveStates[segment.id] ?? { status: "idle" as const };

              return (
                <form
                  key={segment.id}
                  className="rounded-xl border border-outline-variant bg-surface-container-low/50 p-5 space-y-5"
                  onSubmit={(event) => void handleSegmentSave(event, segment.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-medium text-on-surface">
                        {segment.code} · {segment.name}
                      </h2>
                      <p className="mt-1 text-sm text-on-surface-variant">
                        当前认领人: {segment.currentParticipantName ?? "暂无"}
                      </p>
                    </div>
                    <SegmentStatusBadge status={segment.status} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <MetaCard
                      icon={<UserRound className="w-4 h-4" />}
                      label="当前参与者"
                      value={segment.currentParticipantName ?? "未分配"}
                    />
                    <MetaCard
                      icon={<Clock3 className="w-4 h-4" />}
                      label="最近更新时间"
                      value={formatDateTime(segment.updatedAt)}
                    />
                    <MetaCard label="认领时间" value={formatDateTime(segment.claimedAt)} />
                    <MetaCard label="释放时间" value={formatDateTime(segment.releasedAt)} />
                  </div>

                  <div className="space-y-4">
                    <FormField label="时间段说明">
                      <textarea
                        className="w-full bg-surface-variant border border-outline-variant rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-y min-h-28"
                        maxLength={240}
                        onChange={(event) => updateDraft(segment.id, { description: event.target.value })}
                        placeholder="例如：前半段、可做预告、需要主催复核等"
                        rows={4}
                        value={draft.description}
                      />
                    </FormField>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField label="状态">
                        <select
                          className="w-full bg-surface-variant border border-outline-variant rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          onChange={(event) =>
                            updateDraft(segment.id, {
                              status: event.target.value as AdminSegmentItem["status"],
                              currentParticipantId: event.target.value === "held" ? draft.currentParticipantId : "",
                            })
                          }
                          value={draft.status}
                        >
                          {Object.entries(adminSegmentStatusLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </FormField>

                      <FormField label="认领人">
                        <select
                          className="w-full bg-surface-variant border border-outline-variant rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60"
                          disabled={draft.status !== "held" || saveState.status === "submitting"}
                          onChange={(event) => updateDraft(segment.id, { currentParticipantId: event.target.value })}
                          value={draft.currentParticipantId}
                        >
                          <option value="">请选择参与者</option>
                          {state.payload.participants.map((participant) => (
                            <option key={participant.id} value={participant.id}>
                              {participant.displayName}
                              {" · "}
                              {adminParticipantStatusLabels[participant.status]}
                              {participant.currentSegmentCode ? ` · 当前 ${participant.currentSegmentCode}` : ""}
                            </option>
                          ))}
                        </select>
                      </FormField>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-outline-variant space-y-3">
                    {saveState.status === "success" ? <StateNotice message={saveState.message} tone="success" /> : null}
                    {saveState.status === "error" ? <StateNotice message={saveState.message} tone="error" /> : null}
                    <button
                      className="inline-flex min-h-10 items-center justify-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-md hover:bg-primary/90 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={saveState.status === "submitting"}
                      type="submit"
                    >
                      {saveState.status === "submitting" ? "正在保存..." : "保存修正"}
                    </button>
                  </div>
                </form>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function buildDraftMap(items: AdminSegmentItem[]) {
  return Object.fromEntries(items.map((item) => [item.id, buildDraft(item)]));
}

function buildDraft(item: AdminSegmentItem): SegmentDraft {
  return {
    description: item.description ?? "",
    status: item.status,
    currentParticipantId: item.currentParticipantId ?? "",
  };
}

function resolveSegmentTone(status: AdminSegmentItem["status"]): "info" | "warn" | "success" {
  if (status === "completed") {
    return "success";
  }

  if (status === "locked") {
    return "warn";
  }

  return "info";
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-lg border border-outline-variant bg-surface-container-low/80 backdrop-blur-sm">
      <h2 className="text-xs font-mono text-on-surface-variant mb-2 uppercase">{label}</h2>
      <div className="text-2xl font-bold tracking-tight text-on-surface">{value}</div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}

function MetaCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-variant/30 p-4">
      <div className="flex items-center gap-2 text-on-surface-variant">
        {icon}
        <p className="text-xs uppercase tracking-[0.24em]">{label}</p>
      </div>
      <p className="mt-2 text-sm text-on-surface break-words">{value}</p>
    </div>
  );
}

function SegmentStatusBadge({ status }: { status: AdminSegmentItem["status"] }) {
  const tone = resolveSegmentTone(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium",
        tone === "success" && "bg-tertiary/10 text-tertiary border-tertiary/20",
        tone === "warn" && "bg-primary/10 text-primary border-primary/20",
        tone === "info" && "bg-surface-variant text-on-surface-variant border-outline-variant",
      )}
    >
      <Clock className="w-3.5 h-3.5" /> {adminSegmentStatusLabels[status]}
    </span>
  );
}

function StateNotice({
  message,
  tone = "info",
}: {
  message: string;
  tone?: "info" | "error" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        tone === "error" && "border-error/40 bg-error/8 text-error",
        tone === "success" && "border-tertiary/25 bg-tertiary/10 text-tertiary",
        tone === "info" && "border-outline-variant bg-surface-container-low/80 text-on-surface-variant",
      )}
    >
      {message}
    </div>
  );
}
