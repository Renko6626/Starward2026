import { useSiteTranslation } from "../../i18n/use-site-translation";
import { formatScheduledTime } from "../../app/lib/format";
import { useEffect, useRef, useState } from "react";
import { Button, Field, Notice } from "../../app/components/ui";
import { requestJson } from "../../app/lib/api";
import { createSwapInputSchema, type CollaborationMutationResponse, type CollaborationResponse, type CollaborationSegment } from "../../shared/collaboration";
import type { PortalCurrentSegmentResponse, PortalSegmentMutationResponse } from "../../shared/portal";
import { ScheduleGrid } from "./ScheduleGrid";
import { getScheduleAction } from "../lib/schedule-selection";

export function ScheduleSection({ collaboration, onSaved, revision, selectedSegmentId, onResult }: {
  collaboration: CollaborationResponse;
  onSaved: () => Promise<void>;
  revision: number;
  selectedSegmentId?: string;
  onResult?: (message: string) => void;
}) {
  const { t, language, label: systemLabel } = useSiteTranslation();
  const [schedule, setSchedule] = useState<PortalCurrentSegmentResponse | null>(null);
  const [loadedRevision, setLoadedRevision] = useState(-1);
  const [loadedLanguage, setLoadedLanguage] = useState<string | null>(null);
  const loadSequence = useRef(0);
  const [stale, setStale] = useState(false);
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [swapMessage, setSwapMessage] = useState("");
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const permissionsReady = loadedRevision === revision && loadedLanguage === language && !stale;

  useEffect(() => {
    const sequence = ++loadSequence.current;
    let cancelled = false;
    void requestJson<PortalCurrentSegmentResponse>("/api/portal/segments/current")
      .then(value => {
        if (!cancelled && sequence === loadSequence.current) {
          setSchedule(value);
          setLoadedRevision(revision);
          setLoadedLanguage(language);
          setStale(false);
          setRefreshWarning(null);
        }
      })
      .catch(caught => {
        if (!cancelled && sequence === loadSequence.current) setRefreshWarning(caught instanceof Error ? caught.message : t("portal.schedule.permissionsError"));
      });
    return () => { cancelled = true; };
  }, [revision, language]);

  async function mutate(segmentId: string | null, close: () => void, swap = false) {
    if (busy || !permissionsReady || !schedule) return;
    ++loadSequence.current;
    setBusy(true);
    setNotice(null);
    setRefreshWarning(null);
    try {
      const endpoint = swap ? "/api/portal/swaps" : segmentId === null
        ? "/api/portal/segments/release"
        : schedule?.currentSegment ? "/api/portal/segments/change" : "/api/portal/segments/claim";
      const parsed = swap ? createSwapInputSchema.safeParse({ segmentId, message: swapMessage }) : null;
      if (parsed && !parsed.success) throw new Error(t("portal.swap.noteTooLong"));
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
      await onSaved().catch(() => setRefreshWarning(t("portal.schedule.completedRefresh")));
    } catch (caught) {
      setNotice({ text: caught instanceof Error ? caught.message : t("portal.schedule.changeError"), error: true });
    } finally {
      setBusy(false);
    }
  }

  function actions(segment: CollaborationSegment, close: () => void) {
    if (!schedule) return <p>{t("portal.schedule.permissionsLoading")}</p>;
    const operationSucceeded = Boolean(selectedSegmentId && notice && !notice.error);
    const action = getScheduleAction(segment, collaboration.participantId, operationSucceeded);
    if (!action) return null;
    const alreadyRequested = collaboration.requests.some(request => request.status === "pending"
      && request.recipientSegmentId === segment.id && request.requesterId === collaboration.participantId);
    return <div className="schedule-detail-actions">
      {action === "select" ? <>
        <p>{schedule.currentSegment
          ? t("portal.schedule.moveConfirmation", { previousTime: formatScheduledTime(schedule.currentSegment.scheduledAt, language), newTime: formatScheduledTime(segment.scheduledAt, language) })
          : t("portal.schedule.claimConfirmation", { time: formatScheduledTime(segment.scheduledAt, language) })}</p>
        <Button appearance="framed" className="button--accent" aria-busy={busy} disabled={busy || !permissionsReady || (schedule.currentSegment ? !schedule.actions.canChange : !schedule.actions.canClaim)}
          onClick={() => void mutate(segment.id, close)}>{schedule.currentSegment ? t("portal.schedule.confirmMove") : t("portal.schedule.confirmClaim")}</Button>
      </> : action === "release" ? <>
        <p>{t("portal.schedule.ownSlotHint")}{segment.kind === "special" ? t("portal.schedule.specialReleaseHint") : t("portal.schedule.regularReleaseHint")}</p>
        <Button appearance="industrial" variant="danger" aria-busy={busy} disabled={busy || !permissionsReady || !schedule.actions.canRelease}
          onClick={() => void mutate(null, close)}>{t("portal.schedule.confirmRelease")}</Button>
        <p className="field-hint">{systemLabel(schedule.actions.releaseHint)}</p>
      </> : action === "swap" ? <>
        <p>{schedule.currentSegment ? t("portal.swap.timesConfirmation", { myTime: formatScheduledTime(schedule.currentSegment.scheduledAt, language), theirTime: formatScheduledTime(segment.scheduledAt, language) }) : t("portal.swap.claimFirst")}</p>
        {alreadyRequested ? <Notice>{t("portal.swap.requestSent")}</Notice> : <>
          <Field label={t("portal.swap.note")}><textarea className="field-input" rows={3} maxLength={500} placeholder={t("portal.swap.notePlaceholder")}
            value={swapMessage} disabled={busy || !permissionsReady || !collaboration.canSwap}
            onChange={event => setSwapMessage(event.target.value)} /></Field>
          <Button appearance="framed" className="button--accent" aria-busy={busy} disabled={busy || !permissionsReady || !collaboration.canSwap} onClick={() => void mutate(segment.id, close, true)}>{t("portal.swap.send")}</Button>
        </>}
      </> : null}
      {!selectedSegmentId && notice?.error ? <Notice tone="error">{systemLabel(notice.text)}</Notice> : null}
      {!permissionsReady ? <p className="field-hint">{t("portal.schedule.refreshPermissions")}</p> : null}
    </div>;
  }

  if (selectedSegmentId) {
    const segment = collaboration.segments.find(item => item.id === selectedSegmentId);
    return <div className="schedule-inline-actions">
      {segment ? actions(segment, () => {}) : <Notice>{t("portal.schedule.changed")}</Notice>}
      {!collaboration.canSwap && segment?.status === "confirmed" && segment.participantId !== collaboration.participantId ? <p className="field-hint">{t("portal.swap.requirements")}</p> : null}
      {refreshWarning ? <Notice tone="warning">{systemLabel(refreshWarning)}</Notice> : null}
      {notice ? <Notice tone={notice.error ? "error" : "success"}>{systemLabel(notice.text)}</Notice> : null}
    </div>;
  }

  return <div className="space-y-6">
    <p>{schedule ? schedule.currentSegment ? systemLabel(schedule.actions.changeHint) : systemLabel(schedule.actions.claimHint) : t("portal.schedule.loadingBrowse")}</p>
    <ScheduleGrid segments={collaboration.segments} participantId={collaboration.participantId} renderActions={actions} />
    {!collaboration.canSwap ? <p className="field-hint">{t("portal.swap.requirements")}</p> : null}
    {refreshWarning ? <Notice tone="warning">{systemLabel(refreshWarning)}</Notice> : null}
    {notice ? <Notice tone={notice.error ? "error" : "success"}>{systemLabel(notice.text)}</Notice> : null}
  </div>;
}
