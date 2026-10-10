import { formatScheduledTime } from "../../app/lib/format";
import { useEffect, useState } from "react";
import { Button, Field, Notice } from "../../app/components/ui";
import { requestJson } from "../../app/lib/api";
import { createSwapInputSchema, type CollaborationMutationResponse, type CollaborationResponse, type CollaborationSegment } from "../../shared/collaboration";
import type { PortalCurrentSegmentResponse, PortalSegmentMutationResponse } from "../../shared/portal";
import { ScheduleGrid } from "./ScheduleGrid";

export function ScheduleSection({ collaboration, onSaved, revision, selectedSegmentId, onResult }: {
  collaboration: CollaborationResponse;
  onSaved: () => Promise<void>;
  revision: number;
  selectedSegmentId?: string;
  onResult?: (message: string) => void;
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
        if (!cancelled) setRefreshWarning(caught instanceof Error ? caught.message : "无法读取排期权限，请点击作者页面的更新进度。");
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
      onResult?.(response.message);
      setStale(true);
      if ("segment" in response) setSchedule(current => current ? { ...current, currentSegment: response.segment } : current);
      if (swap) setSwapMessage("");
      close();
      await onSaved().catch(() => setRefreshWarning("操作已完成，但摘要暂未更新，请点击作者页面的更新进度。"));
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
          ? `将你的发布时点从 ${formatScheduledTime(schedule.currentSegment.scheduledAt)} 调整到 ${formatScheduledTime(segment.scheduledAt)}，原发布时点会同时释放。`
          : `确认后认领 ${formatScheduledTime(segment.scheduledAt)}。`}</p>
        <Button disabled={busy || !permissionsReady || (schedule.currentSegment ? !schedule.actions.canChange : !schedule.actions.canClaim)}
          onClick={() => void mutate(segment.id, close)}>{schedule.currentSegment ? "确认调整到这个发布时点" : "确认认领这个发布时点"}</Button>
      </> : own ? <>
        <p>这是你当前持有的发布时点。释放后会重新开放给其他创作者。</p>
        <Button variant="danger" disabled={busy || !permissionsReady || !schedule.actions.canRelease}
          onClick={() => void mutate(null, close)}>确认释放当前发布时点</Button>
        <p className="field-hint">{schedule.actions.releaseHint}</p>
      </> : segment.status === "confirmed" ? <>
        <p>{schedule.currentSegment ? `你的时点：${formatScheduledTime(schedule.currentSegment.scheduledAt)}；对方的时点：${formatScheduledTime(segment.scheduledAt)}。对方同意后交换，等待回应期间双方保留原时点。` : "先认领一个空闲发布时点，再向其他创作者请求交换。"}</p>
        {alreadyRequested ? <Notice>请求已发出，可以在待办与反馈中查看或取消。</Notice> : <>
          <Field label="换期说明（选填）"><textarea className="field-input" rows={3} maxLength={500} placeholder="简要说明希望交换时间的原因，可不填"
            value={swapMessage} disabled={busy || !permissionsReady || !collaboration.canSwap}
            onChange={event => setSwapMessage(event.target.value)} /></Field>
          <Button disabled={busy || !permissionsReady || !collaboration.canSwap} onClick={() => void mutate(segment.id, close, true)}>发送换期请求</Button>
        </>}
      </> : null}
      {!selectedSegmentId && notice?.error ? <Notice tone="error">{notice.text}</Notice> : null}
      {!permissionsReady ? <p className="field-hint">操作权限更新后可以确认调整。可点击作者页面的更新进度重新读取。</p> : null}
    </div>;
  }

  if (selectedSegmentId) {
    const segment = collaboration.segments.find(item => item.id === selectedSegmentId);
    return <div className="schedule-inline-actions">
      {segment ? actions(segment, () => {}) : <Notice>时点信息已变化，请重新选择。</Notice>}
      {!collaboration.canSwap && segment?.status === "confirmed" && segment.participantId !== collaboration.participantId ? <p className="field-hint">交换需双方持有已确认发布时点，并处于变更开放期间。</p> : null}
      {refreshWarning ? <Notice tone="warning">{refreshWarning}</Notice> : null}
      {notice ? <Notice tone={notice.error ? "error" : "success"}>{notice.text}</Notice> : null}
    </div>;
  }

  return <div className="space-y-6">
    <p>{schedule ? schedule.currentSegment ? schedule.actions.changeHint : schedule.actions.claimHint : "正在读取排期权限，可以先查看发布时点。"}</p>
    <ScheduleGrid segments={collaboration.segments} participantId={collaboration.participantId} renderActions={actions} />
    {!collaboration.canSwap ? <p className="field-hint">交换需双方持有已确认发布时点，并处于变更开放期间。</p> : null}
    {refreshWarning ? <Notice tone="warning">{refreshWarning}</Notice> : null}
    {notice ? <Notice tone={notice.error ? "error" : "success"}>{notice.text}</Notice> : null}
  </div>;
}
