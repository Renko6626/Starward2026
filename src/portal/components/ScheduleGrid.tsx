import { useSiteTranslation } from "../../i18n/use-site-translation";
import { formatScheduledTime } from "../../app/lib/format";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button, Notice, StatusBadge } from "../../app/components/ui";
import type { CollaborationSegment } from "../../shared/collaboration";
import { localizeSegmentName } from "../../shared/i18n";



type Filter = "all" | "available" | "mine";

/** One roster view for registration and later schedule adjustments. */
export function ScheduleGrid({
  segments,
  participantId,
  selectedSegmentId,
  canChoose = false,
  onChoose,
  renderActions,
}: {
  segments: CollaborationSegment[];
  participantId: string;
  selectedSegmentId?: string | null;
  canChoose?: boolean;
  onChoose?: (segment: CollaborationSegment) => void;
  renderActions?: (segment: CollaborationSegment, close: () => void) => ReactNode;
}) {
  const { t, language } = useSiteTranslation();
  const statusLabels = {
    available: t("portal.schedule.available"),
    reserved: t("portal.schedule.pending"),
    confirmed: t("portal.schedule.confirmed"),
    unavailable: t("portal.schedule.notSelectable"),
  } as const;
  const [filter, setFilter] = useState<Filter>("all");
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const detailHeading = useId();
  const inspected = segments.find(segment => segment.id === inspectedId);
  const selected = segments.find(segment => segment.id === selectedSegmentId);
  const own = (segment: CollaborationSegment) => Boolean(participantId) && segment.participantId === participantId;
  const available = segments.filter(segment => segment.status === "available");
  const mine = segments.filter(own);
  const visible = filter === "available" ? available : filter === "mine" ? mine : segments;
  const selectable = inspected && (inspected.status === "available" || own(inspected));

  useEffect(() => {
    const query = window.matchMedia("(max-width: 640px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const element = dialog.current;
    if (!mobile || !inspected || !element) return;
    element.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      if (element.open) element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [mobile, inspected?.id]);

  function close() {
    setInspectedId(null);
    trigger.current?.focus({ preventScroll: true });
  }

  function changeFilter(next: Filter) {
    setFilter(next);
    setInspectedId(null);
  }

  const detail = inspected ? <>
    <div className="schedule-detail-header">
      <div><p className="field-hint">{t("portal.schedule.slot")}{inspected.code}</p><h3 id={detailHeading}>{localizeSegmentName(inspected.code, inspected.name, language)}</h3><p>{formatScheduledTime(inspected.scheduledAt, language)}</p></div>
      <Button variant="secondary" onClick={close}>{t("portal.schedule.closeDetails")}</Button>
    </div>
    <StatusBadge tone={own(inspected) ? "success" : inspected.status === "reserved" ? "warning" : "muted"}>
      {own(inspected) ? inspected.status === "reserved" ? t("portal.schedule.myReservation") : t("portal.schedule.mySlot") : statusLabels[inspected.status]}
    </StatusBadge>
    {inspected.publicName ? <p>{t("portal.profile.publicCredit")}{inspected.publicName}</p> : null}
    {inspected.description ? <p className="schedule-detail-description">{inspected.description}</p> : null}
    {inspected.status === "reserved" && !own(inspected) ? <Notice>{t("portal.schedule.reservedReviewHint")}</Notice> : null}
    {onChoose ? <div className="workspace-actions">
      <Button disabled={!canChoose || !selectable} onClick={() => { onChoose(inspected); close(); }}>
        {selectedSegmentId === inspected.id ? t("portal.schedule.keepSlot") : t("portal.schedule.chooseSlot")}
      </Button>
      <p className="field-hint">{t("portal.schedule.reserveOnSubmission")}</p>
    </div> : null}
    {renderActions?.(inspected, close)}
  </> : null;

  return <div className="schedule-browser">
    <div className="schedule-grid-toolbar" role="group" aria-label={t("portal.schedule.filter")}>
      <Button variant="secondary" aria-pressed={filter === "all"} onClick={() => changeFilter("all")}>{t("portal.schedule.all")} {segments.length}</Button>
      <Button variant="secondary" aria-pressed={filter === "available"} onClick={() => changeFilter("available")}>{t("portal.schedule.available")} {available.length}</Button>
      <Button variant="secondary" aria-pressed={filter === "mine"} onClick={() => changeFilter("mine")}>{t("portal.schedule.mine")} {mine.length}</Button>
    </div>
    {onChoose ? <p className="schedule-selection-summary" role="status">
      {selected ? t("portal.schedule.selectedSummary", { name: localizeSegmentName(selected.code, selected.name, language) }) : t("portal.schedule.selectionInstructions")}
    </p> : <p className="field-hint">{t("portal.schedule.detailsInstructions")}</p>}
    {selected && !own(selected) && selected.status !== "available" && onChoose ? <Notice tone="warning">{t("portal.schedule.selectedUnavailable")}</Notice> : null}
    <div className={`schedule-browser-content${inspected && !mobile ? " has-detail" : ""}`}>
      <div className="schedule-grid-scroll">
        {visible.length ? <div className="schedule-slot-grid" aria-label={t("portal.schedule.relayOrder")}>
          {visible.map(segment => <button
            type="button"
            key={segment.id}
            className={`schedule-slot schedule-slot--${segment.status}${own(segment) ? " is-mine" : ""}${selectedSegmentId === segment.id ? " is-selected" : ""}`}
            aria-pressed={inspectedId === segment.id}
            aria-haspopup={mobile ? "dialog" : undefined}
            onClick={event => { trigger.current = event.currentTarget; setInspectedId(segment.id); }}
          >
            <span className="schedule-slot-code">{segment.code}</span>
            <strong>{formatScheduledTime(segment.scheduledAt, language)}</strong>
            <span>{own(segment) ? segment.status === "reserved" ? t("portal.schedule.myReservation") : t("portal.schedule.mySlot") : statusLabels[segment.status]}</span>
            {segment.publicName ? <span>{segment.publicName}</span> : null}
            {selectedSegmentId === segment.id && onChoose ? <span className="schedule-slot-selected">{t("portal.schedule.selected")}</span> : null}
          </button>)}
        </div> : <p className="workspace-empty" role="status">
          {filter === "available" ? t("portal.schedule.availableEmpty") : filter === "mine" ? t("portal.schedule.mineEmpty") : t("portal.schedule.empty")}
        </p>}
      </div>
      {inspected && !mobile ? <aside className="schedule-detail-panel" aria-labelledby={detailHeading}>{detail}</aside> : null}
    </div>
    {inspected && mobile ? <dialog ref={dialog} className="schedule-detail-dialog" aria-labelledby={detailHeading} onCancel={event => { event.preventDefault(); close(); }} onClose={() => setInspectedId(null)}>{detail}</dialog> : null}
  </div>;
}
