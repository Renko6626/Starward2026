import { useSiteTranslation } from "../../i18n/use-site-translation";
import { useState } from "react";
import { localizeSegmentName } from "../../shared/i18n";
import { Button, Notice, StatusBadge } from "../../app/components/ui";
import { requestJson } from "../../app/lib/api";
import type { CollaborationMutationResponse, CollaborationResponse } from "../../shared/collaboration";


export function SwapRequests({ collaboration, onSaved }: { collaboration: CollaborationResponse; onSaved: () => Promise<void> }) {
  const { t, language, label: systemLabel } = useSiteTranslation();
  const labels = { pending: t("portal.swap.pending"), accepted: t("portal.swap.accepted"), rejected: t("portal.swap.rejected"), cancelled: t("portal.swap.cancelled"), expired: t("portal.swap.expired") };
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  async function respond(id: string, action: "accept" | "reject" | "cancel") {
    setBusy(id); setNotice(null); setRefreshWarning(null);
    try {
      const result = await requestJson<CollaborationMutationResponse>(`/api/portal/swaps/${encodeURIComponent(id)}/respond`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      setNotice({ text: result.message, error: false });
      await onSaved().catch(() => setRefreshWarning(t("portal.swap.completedRefresh")));
    } catch (caught) { setNotice({ text: caught instanceof Error ? caught.message : t("portal.swap.respondError"), error: true }); }
    finally { setBusy(null); }
  }
  return <div className="space-y-4">
    {!collaboration.requests.length ? <p className="workspace-empty">{t("portal.swap.empty")}</p> : collaboration.requests.map(request => {
      const outgoing = request.requesterId === collaboration.participantId;
      const pending = request.status === "pending";
      return <article className="swap-request" key={request.id}>
        <div><h3>{outgoing ? t("portal.swap.outgoing", { author: request.recipientName }) : t("portal.swap.incoming", { author: request.requesterName })}</h3><StatusBadge tone={pending ? "warning" : "muted"}>{labels[request.status]}</StatusBadge></div>
        <p>{t("portal.swap.slots", { requesterSlot: localizeSegmentName(collaboration.segments.find(segment => segment.id === request.requesterSegmentId)?.code, request.requesterSegmentName, language), recipientSlot: localizeSegmentName(collaboration.segments.find(segment => segment.id === request.recipientSegmentId)?.code, request.recipientSegmentName, language) })}</p>
        {request.message ? <p>{request.message}</p> : null}
        {pending ? <><p className="field-hint">{t("portal.swap.effectHint")}</p><div className="workspace-actions">{outgoing ? <Button appearance="industrial" variant="secondary" disabled={busy !== null} onClick={() => void respond(request.id, "cancel")}>{t("portal.swap.cancel")}</Button> : <><Button appearance="industrial" disabled={busy !== null || !collaboration.canSwap} onClick={() => void respond(request.id, "accept")}>{t("portal.swap.accept")}</Button><Button appearance="industrial" variant="secondary" disabled={busy !== null} onClick={() => void respond(request.id, "reject")}>{t("portal.swap.reject")}</Button></>}</div></> : null}
      </article>;
    })}
    {refreshWarning ? <Notice tone="warning">{systemLabel(refreshWarning)}</Notice> : null}
    {notice ? <Notice tone={notice.error ? "error" : "success"}>{systemLabel(notice.text)}</Notice> : null}
  </div>;
}
