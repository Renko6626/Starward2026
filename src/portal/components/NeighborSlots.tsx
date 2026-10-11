import { useSiteTranslation } from "../../i18n/use-site-translation";
import { useEffect, useState } from "react";
import { Button, Notice } from "../../app/components/ui";
import { requestJson } from "../../app/lib/api";
import { formatScheduledTime } from "../../app/lib/format";
import type { CollaborationResponse, PortalNeighbor, PortalNeighborsResponse } from "../../shared/collaboration";
import { getBilibiliProfileUrl } from "../lib/profile-form";
import { localizeSegmentName } from "../../shared/i18n";

export function NeighborSlots({ revision = 0, collaboration, onSaved }: { revision?: number; collaboration: CollaborationResponse; onSaved: () => Promise<void> }) {
  const { t, language, label: systemLabel } = useSiteTranslation();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function requestSwap(segmentId: string) {
    setSending(true); setError(null); setMessage(null);
    try {
      const response = await requestJson<{ message: string }>("/api/portal/swaps", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ segmentId }) });
      setMessage(response.message);
      await onSaved();
    } catch (caught) { setError(caught instanceof Error ? caught.message : t("portal.swap.requestError")); }
    finally { setSending(false); }
  }
  const [neighbors, setNeighbors] = useState<PortalNeighborsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState<string | null>(null);
  const [copyResult, setCopyResult] = useState<{ segmentId: string; error: boolean } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void requestJson<PortalNeighborsResponse>("/api/portal/neighbors").then(response => {
      if (!cancelled) { setNeighbors(response); setError(null); setCopyResult(null); }
    }).catch(caught => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : t("portal.neighbors.loadError"));
    });
    return () => { cancelled = true; };
  }, [revision, language]);
  async function copyProfile(neighbor: PortalNeighbor, url: string) {
    setCopying(neighbor.segmentId); setCopyResult(null);
    try {
      await navigator.clipboard.writeText(url);
      setCopyResult({ segmentId: neighbor.segmentId, error: false });
    } catch {
      setCopyResult({ segmentId: neighbor.segmentId, error: true });
    } finally { setCopying(null); }
  }
  const card = (label: string, neighbor: PortalNeighbor | null) => {
    const url = neighbor?.bilibiliUid ? getBilibiliProfileUrl(neighbor.bilibiliUid) : undefined;
    const result = copyResult?.segmentId === neighbor?.segmentId ? copyResult : null;
    return <div className="neighbor-card">
    <h4>{label}</h4>
    {neighbor ? <><p>{neighbor.segmentCode} {localizeSegmentName(neighbor.segmentCode, neighbor.segmentName, language)}</p><p>{formatScheduledTime(neighbor.scheduledAt, language)}</p><p>{neighbor.publicName ?? t("portal.schedule.unclaimed")}</p><p className="field-hint">{neighbor.status === "confirmed" ? t("portal.schedule.confirmed") : neighbor.status === "reserved" ? t("portal.schedule.pendingUnconfirmed") : neighbor.status === "available" ? t("portal.schedule.availableSlot") : t("portal.schedule.unavailable")}</p>{url ? <><a className="text-link" href={url} target="_blank" rel="noreferrer">{url}</a><Button appearance="industrial" variant="secondary" disabled={copying !== null} aria-busy={copying === neighbor.segmentId} onClick={() => void copyProfile(neighbor, url)}>{result && !result.error ? t("portal.neighbors.copied") : t("portal.neighbors.copy")}</Button>{result ? <p className="field-hint" role="status">{result.error ? t("portal.neighbors.copyError") : t("portal.neighbors.copySuccess")}</p> : null}</> : neighbor.status === "confirmed" ? <p className="field-hint">{t("portal.neighbors.profileMissing")}</p> : null}{neighbor.kind === "special" && neighbor.status === "confirmed" && neighbor.assignmentStatus === "held" && collaboration.canSwap ? <Button appearance="industrial" disabled={sending || collaboration.requests.some(r => r.status === "pending" && r.requesterId === collaboration.participantId && r.recipientSegmentId === neighbor.segmentId)} onClick={() => void requestSwap(neighbor.segmentId)}>{t("portal.neighbors.requestSwap")}</Button> : null}</> : <p className="field-hint">{t("portal.neighbors.empty")}</p>}
  </div>;
  };
  return <section aria-label={t("portal.neighbors.title")} className="space-y-4"><h3>{t("portal.neighbors.title")}</h3>
    {message ? <Notice tone="success">{systemLabel(message)}</Notice> : null}
    {error ? <Notice tone="warning">{systemLabel(error)}</Notice> : null}
    {neighbors?.currentSegmentId ? <div className="neighbor-grid">{card(t("portal.neighbors.previous"), neighbors.previous)}{card(t("portal.neighbors.next"), neighbors.next)}</div> : <p className="field-hint">{t("portal.neighbors.afterConfirmation")}</p>}
  </section>;
}
