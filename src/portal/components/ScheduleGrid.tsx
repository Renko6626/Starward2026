import { formatScheduledTime } from "../../app/lib/format";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button, Notice, StatusBadge } from "../../app/components/ui";
import type { CollaborationSegment } from "../../shared/collaboration";

const statusLabels = {
  available: "空闲",
  reserved: "待审核",
  confirmed: "已确认",
  unavailable: "不可选择",
} as const;

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
      <div><p className="field-hint">发布时点 {inspected.code}</p><h3 id={detailHeading}>{inspected.name}</h3><p>{formatScheduledTime(inspected.scheduledAt)}</p></div>
      <Button variant="secondary" onClick={close}>关闭详情</Button>
    </div>
    <StatusBadge tone={own(inspected) ? "success" : inspected.status === "reserved" ? "warning" : "muted"}>
      {own(inspected) ? inspected.status === "reserved" ? "我的预留" : "我的发布时点" : statusLabels[inspected.status]}
    </StatusBadge>
    {inspected.publicName ? <p>公开署名：{inspected.publicName}</p> : null}
    {inspected.description ? <p className="schedule-detail-description">{inspected.description}</p> : null}
    {inspected.status === "reserved" && !own(inspected) ? <Notice>这个发布时点已被预留，正在等待审核。</Notice> : null}
    {onChoose ? <div className="workspace-actions">
      <Button disabled={!canChoose || !selectable} onClick={() => { onChoose(inspected); close(); }}>
        {selectedSegmentId === inspected.id ? "保留这个发布时点" : "选这个发布时点"}
      </Button>
      <p className="field-hint">选定后与报名一起提交，提交成功才预留。</p>
    </div> : null}
    {renderActions?.(inspected, close)}
  </> : null;

  return <div className="schedule-browser">
    <div className="schedule-grid-toolbar" role="group" aria-label="筛选发布时点">
      <Button variant="secondary" aria-pressed={filter === "all"} onClick={() => changeFilter("all")}>全部 {segments.length}</Button>
      <Button variant="secondary" aria-pressed={filter === "available"} onClick={() => changeFilter("available")}>空闲 {available.length}</Button>
      <Button variant="secondary" aria-pressed={filter === "mine"} onClick={() => changeFilter("mine")}>我的 {mine.length}</Button>
    </div>
    {onChoose ? <p className="schedule-selection-summary" role="status">
      {selected ? `报名已选：${selected.name}` : "点击发布时点查看详情，再选择报名时间。"}
    </p> : <p className="field-hint">点击发布时点查看详情，调整或交换需另行确认。</p>}
    {selected && !own(selected) && selected.status !== "available" && onChoose ? <Notice tone="warning">所选发布时点现在已不可选，请重新选择。</Notice> : null}
    <div className={`schedule-browser-content${inspected && !mobile ? " has-detail" : ""}`}>
      <div className="schedule-grid-scroll">
        {visible.length ? <div className="schedule-slot-grid" aria-label="按接力顺序排列的发布时点">
          {visible.map(segment => <button
            type="button"
            key={segment.id}
            className={`schedule-slot schedule-slot--${segment.status}${own(segment) ? " is-mine" : ""}${selectedSegmentId === segment.id ? " is-selected" : ""}`}
            aria-pressed={inspectedId === segment.id}
            aria-haspopup={mobile ? "dialog" : undefined}
            onClick={event => { trigger.current = event.currentTarget; setInspectedId(segment.id); }}
          >
            <span className="schedule-slot-code">{segment.code}</span>
            <strong>{formatScheduledTime(segment.scheduledAt)}</strong>
            <span>{own(segment) ? segment.status === "reserved" ? "我的预留" : "我的发布时点" : statusLabels[segment.status]}</span>
            {segment.publicName ? <span>{segment.publicName}</span> : null}
            {selectedSegmentId === segment.id && onChoose ? <span className="schedule-slot-selected">报名已选</span> : null}
          </button>)}
        </div> : <p className="workspace-empty" role="status">
          {filter === "available" ? "当前没有空闲发布时点，可以切回全部查看排期。" : filter === "mine" ? "你还没有预留或认领发布时点。" : "当前还没有配置发布时点。"}
        </p>}
      </div>
      {inspected && !mobile ? <aside className="schedule-detail-panel" aria-labelledby={detailHeading}>{detail}</aside> : null}
    </div>
    {inspected && mobile ? <dialog ref={dialog} className="schedule-detail-dialog" aria-labelledby={detailHeading} onCancel={event => { event.preventDefault(); close(); }} onClose={() => setInspectedId(null)}>{detail}</dialog> : null}
  </div>;
}
