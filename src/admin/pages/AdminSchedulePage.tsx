import { useEffect, useState, type FormEvent } from "react";
import {
  adminParticipantStatusLabels,
  adminSegmentStatusLabels,
  type AdminParticipantListResponse,
  type AdminSegmentBootstrapResponse,
  type AdminSegmentItem,
  type AdminSegmentListResponse,
  type AdminSegmentMutationResponse,
} from "../../shared/admin";
import { SectionCard } from "../../app/components/SectionCard";
import { requestJson } from "../../app/lib/api";

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
      const payload = await requestJson<AdminSegmentMutationResponse>(
        `/api/admin/segments/${segmentId}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            description: draft.description,
            status: draft.status,
            currentParticipantId: draft.status === "held" ? draft.currentParticipantId || null : null,
          }),
        },
      );

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

  return (
    <SectionCard
      eyebrow="后台 / 时间段"
      title="时间段状态总览"
      description="一期先把查看和人工纠偏入口放在这里。当前数据使用 `schedule_segments`。"
    >
      {state.status === "loading" ? <p>正在读取时间段状态。</p> : null}
      {state.status === "error" ? (
        <p className="inline-message inline-message--error">{state.message}</p>
      ) : null}
      {bootstrap.status === "success" ? (
        <p className="inline-message inline-message--success">{bootstrap.message}</p>
      ) : null}
      {state.status === "ready" && state.payload.segments.length === 0 ? (
        <div className="mini-card mini-card--compact">
          <strong>时间段还未初始化</strong>
          <p>当前默认排期已经创建，但还没有插入 `schedule_segments`。这里先做一期最低可用初始化，后续再补单条编辑和重排。</p>
          <form className="form-grid" onSubmit={handleBootstrap}>
            <label className="field">
              <span>初始时间段数量</span>
              <input
                inputMode="numeric"
                max={120}
                min={1}
                onChange={(event) => setBootstrapCount(event.target.value)}
                placeholder="例如 12"
                type="number"
                value={bootstrapCount}
              />
            </label>
            <p className="inline-message">
              这一数量只用于生成当前 active schedule 的初始时间段，编号会按数量自动补零。
            </p>
            <div className="action-row">
              <button
                className="button--primary"
                disabled={bootstrap.status === "submitting"}
                type="submit"
              >
                {bootstrap.status === "submitting" ? "正在初始化..." : "初始化时间段"}
              </button>
            </div>
            {bootstrap.status === "error" ? (
              <p className="inline-message inline-message--error">{bootstrap.message}</p>
            ) : null}
          </form>
        </div>
      ) : null}
      {state.status === "ready" && state.payload.segments.length > 0 ? (
        <>
          <p className="inline-message">
            这里允许管理员直接修正单个时间段。若把某位参与者改到新的 `held` 时间段，系统会自动释放他原先持有的时间段，并同步 `project_drafts.segment_id`。
          </p>
          <div className="route-grid">
            {state.payload.segments.map((segment) => {
              const draft = drafts[segment.id] ?? buildDraft(segment);
              const saveState = saveStates[segment.id] ?? { status: "idle" as const };

              return (
                <form
                  key={segment.id}
                  className="mini-card mini-card--tall form-grid"
                  onSubmit={(event) => void handleSegmentSave(event, segment.id)}
                >
                  <div>
                    <strong>
                      {segment.code} · {segment.name}
                    </strong>
                    <p>当前状态：{adminSegmentStatusLabels[segment.status]}</p>
                    <p>当前认领人：{segment.currentParticipantName ?? "暂无"}</p>
                  </div>

                  <label className="field">
                    <span>时间段说明</span>
                    <textarea
                      maxLength={240}
                      onChange={(event) => updateDraft(segment.id, { description: event.target.value })}
                      placeholder="例如：前半段、可做预告、需要主催复核等"
                      value={draft.description}
                    />
                  </label>

                  <label className="field">
                    <span>状态</span>
                    <select
                      onChange={(event) =>
                        updateDraft(segment.id, {
                          status: event.target.value as AdminSegmentItem["status"],
                          currentParticipantId:
                            event.target.value === "held" ? draft.currentParticipantId : "",
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
                  </label>

                  <label className="field">
                    <span>认领人</span>
                    <select
                      disabled={draft.status !== "held" || saveState.status === "submitting"}
                      onChange={(event) =>
                        updateDraft(segment.id, { currentParticipantId: event.target.value })
                      }
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
                  </label>

                  {draft.status !== "held" ? (
                    <p className="inline-message">非 `held` 状态不会保留认领人。</p>
                  ) : null}

                  <div className="action-row">
                    <button
                      className="button--primary"
                      disabled={saveState.status === "submitting"}
                      type="submit"
                    >
                      {saveState.status === "submitting" ? "正在保存..." : "保存修正"}
                    </button>
                  </div>

                  {saveState.status === "success" ? (
                    <p className="inline-message inline-message--success">{saveState.message}</p>
                  ) : null}
                  {saveState.status === "error" ? (
                    <p className="inline-message inline-message--error">{saveState.message}</p>
                  ) : null}
                </form>
              );
            })}
          </div>
        </>
      ) : null}
    </SectionCard>
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
