import { useEffect, useState, type FormEvent } from "react";
import { Clock } from "../../app/components/icons";
import {
  ReadError,
  Field as FormField,
  MetricCard,
  PageHeading,
  StateNotice,
  Button,
  StatusBadge,
} from "../../app/components/ui";
import { requestJson } from "../../app/lib/api";
import { cn } from "../../app/lib/cn";
import { formatDateTime, formatScheduledTime } from "../../app/lib/format";
import {
  adminParticipantStatusLabels,
  adminSegmentStatusLabels,
  type AdminParticipantListResponse,
  type CreateSegmentInput,
  type AdminSegmentBootstrapResponse,
  type AdminSegmentItem,
  type AdminSegmentListResponse,
  type AdminSegmentMutationResponse,
} from "../../shared/admin";

import { summarizeSchedule } from "../lib/creator-list";
import { QuickSchedule } from "../components/QuickSchedule";

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
  scheduledAt: string;
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
  const [saveStates, setSaveStates] = useState<
    Record<string, SegmentSaveState>
  >({});
  const [bootstrapCount, setBootstrapCount] = useState("12");
  const [bootstrap, setBootstrap] = useState<BootstrapState>({
    status: "idle",
  });
  const [appendCount, setAppendCount] = useState('6');
  const [append, setAppend] = useState<BootstrapState>({ status: 'idle' });
  const [quickSaving, setQuickSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [visibilityNotice, setVisibilityNotice] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const [newSeat, setNewSeat] = useState({ kind: "standard" as CreateSegmentInput["kind"], name: "", scheduledAt: "", description: "" });
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  async function createSeat(event: FormEvent) {
    event.preventDefault(); setCreating(true); setCreateMessage(null);
    try {
      const response = await requestJson<AdminSegmentBootstrapResponse>("/api/admin/segments", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...newSeat, scheduledAt: new Date(`${newSeat.scheduledAt}:00+08:00`).toISOString() }),
      });
      setNewSeat(current => ({ ...current, name: "", scheduledAt: "", description: "" }));
      await loadSchedulePage(); setCreateMessage(response.message);
    } catch (error) { setCreateMessage(error instanceof Error ? error.message : "新增失败。"); }
    finally { setCreating(false); }
  }

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
        message:
          error instanceof Error ? error.message : "无法读取发布时点状态。",
      });
    }
  }

  function updateDraft(segmentId: string, patch: Partial<SegmentDraft>) {
    setDrafts((current) => ({
      ...current,
      [segmentId]: {
        ...(current[segmentId] ?? {
          scheduledAt: "",
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
      const payload = await requestJson<AdminSegmentBootstrapResponse>(
        "/api/admin/segments/bootstrap",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ count }),
        },
      );

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
        message: error instanceof Error ? error.message : "初始化发布时点失败。",
      });
    }
  }

  async function handleAppend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const count = Number(appendCount);
    if (!Number.isInteger(count) || count < 1 || count > 120) {
      setAppend({ status: 'error', message: '追加数量必须是 1 到 120 之间的整数。' });
      return;
    }
    setAppend({ status: 'submitting' });
    try {
      const payload = await requestJson<AdminSegmentBootstrapResponse>('/api/admin/segments/append', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ count }),
      });
      setDrafts(current => ({ ...buildDraftMap(payload.items), ...current }));
      setState(current => current.status === 'ready'
        ? { status: 'ready', payload: { ...current.payload, segments: payload.items } } : current);
      setAppend({ status: 'success', message: payload.message });
    } catch (error) {
      setAppend({ status: 'error', message: error instanceof Error ? error.message : '追加坑位失败。' });
    }
  }

  async function handleSegmentSave(
    event: FormEvent<HTMLFormElement>,
    segmentId: string,
  ) {
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
            scheduledAt: draft.scheduledAt ? new Date(`${draft.scheduledAt}:00+08:00`).toISOString() : null,
            description: draft.description,
            status: draft.status,
            currentParticipantId:
              ["held", "locked", "completed"].includes(draft.status)
                ? draft.currentParticipantId || null
                : null,
          }),
        },
      );

      const segments = await requestJson<AdminSegmentListResponse>("/api/admin/segments");
      setDrafts(buildDraftMap(segments.items));
      setState(current => current.status === "ready" ? { status: "ready", payload: { ...current.payload, segments: segments.items } } : current);
      setSaveStates(current => ({ ...current, [segmentId]: { status: "success", message: payload.message } }));
    } catch (error) {
      setSaveStates((current) => ({
        ...current,
        [segmentId]: {
          status: "error",
          message: error instanceof Error ? error.message : "发布时点更新失败。",
        },
      }));
    }
  }

  const segmentMetrics = state.status === "ready" ? summarizeSchedule(state.payload.segments) : null;
  const hasUnsavedDrafts = state.status === 'ready' && state.payload.segments.some(segment =>
    JSON.stringify(drafts[segment.id] ?? buildDraft(segment)) !== JSON.stringify(buildDraft(segment)));
  const scheduleBusy = quickSaving || visibilitySaving || creating || append.status === 'submitting' || Object.values(saveStates).some(value => value.status === 'submitting');

  async function setVisibility(ids: string[], isVisible: boolean) {
    if (state.status !== 'ready' || scheduleBusy || hasUnsavedDrafts) return;
    const pending = state.payload.segments.filter(item => ids.includes(item.id) && item.isVisible !== isVisible);
    if (!pending.length) return;
    setVisibilitySaving(true);
    setVisibilityNotice(null);
    const saved: AdminSegmentItem[] = [];
    try {
      for (const segment of pending) {
        const payload = await requestJson<AdminSegmentMutationResponse>(`/api/admin/segments/${segment.id}`, {
          method: 'PATCH', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mode: 'set-visibility', isVisible }),
        });
        saved.push(payload.item);
      }
      setVisibilityNotice({ tone: 'success', message: `已${isVisible ? '恢复显示' : '隐藏'} ${saved.length} 个发布时点。` });
    } catch (error) {
      setVisibilityNotice({ tone: 'error', message: `已保存 ${saved.length}/${pending.length} 个。${error instanceof Error ? error.message : '保存失败，请重试。'}` });
    } finally {
      acceptQuickSchedule(saved);
      setSelectedIds(current => current.filter(id => !saved.some(item => item.id === id)));
      setVisibilitySaving(false);
    }
  }

  function acceptQuickSchedule(items: AdminSegmentItem[], replace = false) {
    const updates = new Map(items.map(item => [item.id, item]));
    setState(current => current.status === 'ready' ? { status: 'ready', payload: {
      ...current.payload, segments: replace ? items : current.payload.segments.map(item => updates.get(item.id) ?? item),
    } } : current);
    setDrafts(current => replace ? buildDraftMap(items) : { ...current, ...buildDraftMap(items) });
    setSaveStates({});
  }

  return (
    <div className="page-content">
      <PageHeading
        title="接力排期"
      >
        {segmentMetrics ? (
          <div className="text-sm font-mono text-on-surface-variant">
            当前共 {segmentMetrics.total} 个发布时点，隐藏 {state.status === 'ready' ? state.payload.segments.filter(item => !item.isVisible).length : 0} 个
          </div>
        ) : null}
      </PageHeading>

      {segmentMetrics ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard label="总发布时点" value={String(segmentMetrics.total)} />
          <MetricCard label="可认领" value={String(segmentMetrics.open)} />
          <MetricCard label="已认领" value={String(segmentMetrics.held)} />
          <MetricCard label="已完成" value={String(segmentMetrics.completed)} />
        </div>
      ) : null}

      {state.status === "loading" ? (
        <StateNotice message="正在读取发布时点状态。" />
      ) : null}
      {state.status === "error" ? (
        <ReadError message={state.message} />
      ) : null}
      {bootstrap.status === "success" ? (
        <StateNotice message={bootstrap.message} tone="success" />
      ) : null}

      {state.status === "ready" ? <details className="panel admin-disclosure"><summary>新增发布时间</summary>
        <form className="space-y-4 pt-4" onSubmit={event => void createSeat(event)}>
          <FormField label="席位类型"><select className="field-input" value={newSeat.kind} onChange={event => setNewSeat(current => ({ ...current, kind: event.target.value as CreateSegmentInput["kind"] }))}><option value="standard">普通席位（公开）</option><option value="special">特别席位（仅管理员分配）</option></select></FormField>
          <FormField label="名称"><input className="field-input" required maxLength={80} value={newSeat.name} onChange={event => setNewSeat(current => ({ ...current, name: event.target.value }))} /></FormField>
          <FormField label="发布时间（北京时间）"><input className="field-input" type="datetime-local" required value={newSeat.scheduledAt} onChange={event => setNewSeat(current => ({ ...current, scheduledAt: event.target.value }))} /></FormField>
          <FormField label="说明（选填）"><input className="field-input" maxLength={240} value={newSeat.description} onChange={event => setNewSeat(current => ({ ...current, description: event.target.value }))} /></FormField>
          <button className="button button--primary" disabled={scheduleBusy} type="submit">{creating ? "新增中…" : "新增发布时间"}</button>
          {createMessage ? <p role="status">{createMessage}</p> : null}
        </form>
      </details> : null}

      {state.status === "ready" && state.payload.segments.length === 0 ? (
        <section className="panel space-y-6">
          <div className="border-b border-outline-variant pb-4">
            <h2 className="text-base font-mono text-on-surface-variant uppercase">
              初始化发布时点
            </h2>
            <p className="mt-2 text-base text-on-surface-variant">
              当前还没有发布时点记录。先写入一期初始数量，后续再在同页进行人工修正。
            </p>
          </div>

          <form className="max-w-sm space-y-4" onSubmit={handleBootstrap}>
            <FormField label="初始发布时点数量">
              <input
                className="field-input"
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
              {bootstrap.status === "submitting"
                ? "正在初始化..."
                : "初始化发布时点"}
            </button>
            {bootstrap.status === "error" ? (
              <StateNotice message={bootstrap.message} tone="error" />
            ) : null}
          </form>
        </section>
      ) : null}

      {state.status === "ready" && state.payload.segments.length > 0 ? (
        <section className="space-y-4">
          <QuickSchedule segments={state.payload.segments} onSaved={acceptQuickSchedule} onSavingChange={setQuickSaving}
            disabled={hasUnsavedDrafts || visibilitySaving || creating || append.status === 'submitting' || Object.values(saveStates).some(value => value.status === 'submitting')} />
          <fieldset disabled={scheduleBusy} className="space-y-4 min-w-0">
          <details className="panel admin-disclosure">
            <summary>追加坑位</summary>
            <div className="pt-4">
              <p className="mt-2 text-sm text-on-surface-variant">追加坑位显示在公开时间表底部，不占标准排程，沿用现有认领和审核流程。</p>
            </div>
            <form className="flex flex-wrap items-end gap-4" onSubmit={handleAppend}>
              <FormField label="追加数量"><input className="field-input w-28" type="number" min={1} max={120} value={appendCount} onChange={event => setAppendCount(event.target.value)} /></FormField>
              <button type="submit" disabled={append.status === 'submitting'} className="min-h-10 px-4 py-2 bg-primary text-on-primary rounded-md disabled:opacity-60">
                {append.status === 'submitting' ? '正在追加…' : '追加坑位'}
              </button>
            </form>
            {append.status === 'success' || append.status === 'error' ? <StateNotice message={append.message} tone={append.status === 'success' ? 'success' : 'error'} /> : null}
          </details>
          <div className="panel text-base text-on-surface-variant">
            为创作者分配新的发布时点后，原发布时点会自动释放，作品资料会同步关联新的发布时点。
          </div>

          <div className="panel space-y-3">
            <h2 className="panel-title">显示范围</h2>
            <p className="text-sm text-on-surface-variant">隐藏后，时间表和选时间页面将跳过这些槽位，上下棒也不再计入。已存的时间、认领人和作品关联会保留。</p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2"><input type="checkbox" checked={state.payload.segments.length > 0 && selectedIds.length === state.payload.segments.length}
                onChange={event => setSelectedIds(event.target.checked ? state.payload.segments.map(item => item.id) : [])} />全选</label>
              <span className="text-sm">已选 {selectedIds.length} 个</span>
              <Button variant="secondary" disabled={hasUnsavedDrafts || !state.payload.segments.some(item => selectedIds.includes(item.id) && item.isVisible)} onClick={() => void setVisibility(selectedIds, false)}>隐藏所选</Button>
              <Button variant="secondary" disabled={hasUnsavedDrafts || !state.payload.segments.some(item => selectedIds.includes(item.id) && !item.isVisible)} onClick={() => void setVisibility(selectedIds, true)}>恢复所选</Button>
            </div>
            {hasUnsavedDrafts ? <p className="text-sm text-on-surface-variant">请先保存槽位修改，再调整显示范围。</p> : null}
            {visibilitySaving ? <p role="status">正在保存显示范围…</p> : null}
            {visibilityNotice ? <StateNotice {...visibilityNotice} /> : null}
          </div>

          <div className="space-y-3">
            {state.payload.segments.map((segment) => {
              const draft = drafts[segment.id] ?? buildDraft(segment);
              const saveState = saveStates[segment.id] ?? {
                status: "idle" as const,
              };

              return (
                <div key={segment.id} className="panel">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label={`选择 ${segment.code} ${segment.name}`} checked={selectedIds.includes(segment.id)}
                      onChange={event => setSelectedIds(current => event.target.checked ? [...current, segment.id] : current.filter(id => id !== segment.id))} />选择此槽位</label>
                    <div className="flex items-center gap-3">
                      <StatusBadge tone={segment.isVisible ? 'success' : 'muted'}>{segment.isVisible ? '显示中' : '已隐藏'}</StatusBadge>
                      <Button variant="secondary" disabled={hasUnsavedDrafts} onClick={() => void setVisibility([segment.id], !segment.isVisible)}>{segment.isVisible ? '隐藏' : '恢复显示'}</Button>
                    </div>
                  </div>
                <details className="admin-disclosure admin-segment-row">
                  <summary>
                    <span className="font-medium">{segment.code} {segment.name}{segment.kind === "special" ? "（特别席位）" : ""}</span>
                    <span>{formatScheduledTime(segment.scheduledAt)}</span>
                    <span>{segment.currentParticipantName ?? "未分配"}</span>
                    <SegmentStatusBadge status={segment.status} />
                  </summary>
                  <form className="space-y-4 pt-5" onSubmit={event => void handleSegmentSave(event, segment.id)}>
                  <p className="text-sm text-on-surface-variant">最近更新 {formatDateTime(segment.updatedAt)}；认领时间 {formatDateTime(segment.claimedAt)}；释放时间 {formatDateTime(segment.releasedAt)}</p>
                  <div className="space-y-4">
                    {segment.kind === 'extra' ? <p className="text-sm text-on-surface-variant">追加坑位不设置计划发布时间。</p> : <FormField label="发布时间（北京时间）">
                      <input className="field-input" type="datetime-local" required={segment.kind === "special"} value={draft.scheduledAt} onChange={event => updateDraft(segment.id, { scheduledAt: event.target.value })} />
                    </FormField>}
                    <FormField label="发布时点说明">
                      <textarea
                        className="field-input"
                        maxLength={240}
                        onChange={(event) =>
                          updateDraft(segment.id, {
                            description: event.target.value,
                          })
                        }
                        placeholder="例如：前半段、可做预告、需要主催复核等"
                        rows={4}
                        value={draft.description}
                      />
                    </FormField>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField label="状态">
                        <select
                          className="field-input"
                          onChange={(event) =>
                            updateDraft(segment.id, {
                              status: event.target
                                .value as AdminSegmentItem["status"],
                              currentParticipantId:
                                ["held", "locked", "completed"].includes(event.target.value)
                                  ? draft.currentParticipantId
                                  : "",
                            })
                          }
                          value={draft.status}
                        >
                          {Object.entries(adminSegmentStatusLabels).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </FormField>

                      <FormField label="认领人">
                        <select
                          className="field-input"
                          disabled={
                            !["held", "locked", "completed"].includes(draft.status) ||
                            saveState.status === "submitting"
                          }
                          onChange={(event) =>
                            updateDraft(segment.id, {
                              currentParticipantId: event.target.value,
                            })
                          }
                          value={draft.currentParticipantId}
                        >
                          <option value="">请选择参与者</option>
                          {state.payload.participants.map((participant) => (
                            <option key={participant.id} value={participant.id}>
                              {participant.displayName}
                              {"（"}
                              {adminParticipantStatusLabels[participant.status]}
                              {participant.currentSegmentCode
                                ? `，当前 ${participant.currentSegmentCode}`
                                : ""}）
                            </option>
                          ))}
                        </select>
                      </FormField>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-outline-variant space-y-3">
                    {saveState.status === "success" ? (
                      <StateNotice message={saveState.message} tone="success" />
                    ) : null}
                    {saveState.status === "error" ? (
                      <StateNotice message={saveState.message} tone="error" />
                    ) : null}
                    <button
                      className="inline-flex min-h-10 items-center justify-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-md hover:bg-primary/90 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={saveState.status === "submitting"}
                      type="submit"
                    >
                      {saveState.status === "submitting"
                        ? "正在保存..."
                        : "保存修正"}
                    </button>
                  </div>
                  </form>
                </details>
                </div>
              );
            })}
          </div>
          </fieldset>
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
    scheduledAt: item.scheduledAt ? new Date(new Date(item.scheduledAt).getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16) : "",
    description: item.description ?? "",
    status: item.status,
    currentParticipantId: item.currentParticipantId ?? "",
  };
}

function resolveSegmentTone(
  status: AdminSegmentItem["status"],
): "info" | "warn" | "success" {
  if (status === "completed") {
    return "success";
  }

  if (status === "locked") {
    return "warn";
  }

  return "info";
}

function SegmentStatusBadge({
  status,
}: {
  status: AdminSegmentItem["status"];
}) {
  const tone = resolveSegmentTone(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-sm font-medium",
        tone === "success" && "bg-tertiary/10 text-tertiary border-tertiary/20",
        tone === "warn" && "bg-primary/10 text-primary border-primary/20",
        tone === "info" &&
          "bg-surface-variant text-on-surface-variant border-outline-variant",
      )}
    >
      <Clock className="w-3.5 h-3.5" /> {adminSegmentStatusLabels[status]}
    </span>
  );
}
