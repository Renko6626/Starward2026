import { useEffect, useState } from "react";
import { Button, Field, Notice } from "../../app/components/ui";
import { requestJson } from "../../app/lib/api";
import { createSwapInputSchema, type CollaborationMutationResponse, type CollaborationResponse, type CollaborationSegment } from "../../shared/collaboration";
import type { PortalCurrentSegmentResponse, PortalSegmentMutationResponse } from "../../shared/portal";
import { ScheduleGrid } from "./ScheduleGrid";

export function ScheduleSection({ collaboration, onSaved, revision }: {
  collaboration: CollaborationResponse;
  onSaved: () => Promise<void>;
  revision: number;
}) {
  const [schedule, setSchedule] = useState<PortalCurrentSegmentResponse | null>(null);
  const [loadedRevision, setLoadedRevision] = useState(-1);
  const [stale, setStale] = useState(false);
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [swapMessage, setSwapMessage] = useState("");
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const permissionsReady = loadedRevision === revision && !stale;

  useEffect(() => {
    let cancelled = false;
    void requestJson<PortalCurrentSegmentResponse>("/api/portal/segments/current")
      .then(value => {
        if (!cancelled) {
          setSchedule(value);
          setLoadedRevision(revision);
          setStale(false);
          setRefreshWarning(null);
        }
      })
      .catch(caught => {
        if (!cancelled) setRefreshWarning(caught instanceof Error ? caught.message : "无法读取排期权限，请点击工作台的更新进度。");
      });
    return () => { cancelled = true; };
  }, [revision]);

  async function mutate(segmentId: string | null, close: () => void, swap = false) {
    if (busy || !permissionsReady || !schedule) return;
    setBusy(true);
    setNotice(null);
    setRefreshWarning(null);
    try {
      const endpoint = swap ? "/api/portal/swaps" : segmentId === null
        ? "/api/portal/segments/release"
        : schedule?.currentSegment ? "/api/portal/segments/change" : "/api/portal/segments/claim";
      const parsed = swap ? createSwapInputSchema.safeParse({ segmentId, message: swapMessage }) : null;
      if (parsed && !parsed.success) throw new Error("换期说明最多 500 字，请检查后重试。");
      const response = await requestJson<CollaborationMutationResponse | PortalSegmentMutationResponse>(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        ...(segmentId ? { body: JSON.stringify(swap && parsed?.success ? parsed.data : { segmentId }) } : {}),
      });
      setNotice({ text: response.message, error: false });
      setStale(true);
      if ("segment" in response) setSchedule(current => current ? { ...current, currentSegment: response.segment } : current);
      if (swap) setSwapMessage("");
      close();
      await onSaved().catch(() => setRefreshWarning("操作已完成，但摘要暂未更新，请点击工作台的更新进度。"));
    } catch (caught) {
      setNotice({ text: caught instanceof Error ? caught.message : "排期调整失败。", error: true });
    } finally {
      setBusy(false);
    }
  }

  function actions(segment: CollaborationSegment, close: () => void) {
    if (!schedule) return <p>正在读取排期操作权限。</p>;
    const own = segment.participantId === collaboration.participantId;
    const alreadyRequested = collaboration.requests.some(request => request.status === "pending"
      && request.recipientSegmentId === segment.id && request.requesterId === collaboration.participantId);
    return <div className="schedule-detail-actions">
      {segment.status === "available" ? <>
        <p>{schedule.currentSegment
          ? `将你的时段从 ${schedule.currentSegment.name} 调整到 ${segment.name}，原时段会同时释放。`
          : `确认后认领 ${segment.name}。`}</p>
        <Button disabled={busy || !permissionsReady || (schedule.currentSegment ? !schedule.actions.canChange : !schedule.actions.canClaim)}
          onClick={() => void mutate(segment.id, close)}>{schedule.currentSegment ? "确认调整到这个时段" : "确认认领这个时段"}</Button>
      </> : own ? <>
        <p>这是你当前持有的时段。释放后会重新开放给其他创作者。</p>
        <Button variant="danger" disabled={busy || !permissionsReady || !schedule.actions.canRelease}
          onClick={() => void mutate(null, close)}>确认释放当前时段</Button>
        <p className="field-hint">{schedule.actions.releaseHint}</p>
      </> : segment.status === "confirmed" ? <>
        <p>{schedule.currentSegment ? `用你的 ${schedule.currentSegment.name} 与这个时段交换，对方同意后生效。` : "先认领一个空闲时段，再向其他创作者请求交换。"}</p>
        {alreadyRequested ? <Notice>请求已发出，可以在待办与反馈中查看或取消。</Notice> : <>
          <Field label="换期说明（选填）"><textarea className="field-input" rows={3} maxLength={500}
            value={swapMessage} disabled={busy || !permissionsReady || !collaboration.canSwap}
            onChange={event => setSwapMessage(event.target.value)} /></Field>
          <Button disabled={busy || !permissionsReady || !collaboration.canSwap} onClick={() => void mutate(segment.id, close, true)}>发送换期请求</Button>
        </>}
      </> : null}
      {notice?.error ? <Notice tone="error">{notice.text}</Notice> : null}
      {!permissionsReady ? <p className="field-hint">操作权限更新后可以确认调整。可点击工作台的更新进度重新读取。</p> : null}
    </div>;
  }

  return <div className="space-y-6">
    <p>{schedule ? schedule.currentSegment ? schedule.actions.changeHint : schedule.actions.claimHint : "正在读取排期权限，可以先查看时段。"}</p>
    <ScheduleGrid segments={collaboration.segments} participantId={collaboration.participantId} renderActions={actions} />
    {!collaboration.canSwap ? <p className="field-hint">交换需双方持有已确认时段，并处于变更开放期间。</p> : null}
    {refreshWarning ? <Notice tone="warning">{refreshWarning}</Notice> : null}
    {notice ? <Notice tone={notice.error ? "error" : "success"}>{notice.text}</Notice> : null}
  </div>;
}
