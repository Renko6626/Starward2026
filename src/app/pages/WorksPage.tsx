import { useEffect, useRef, useState } from "react";
import { ApiError, requestJson } from "../lib/api";
import { ReadError } from "../components/ui";
import { ObservationMark } from "../components/WorkPresentation";
import { ActivityIdentity } from "../components/ActivityIdentity";
import { ScheduleBoard, ScheduleStatus, ScheduleTaskDetail } from "../components/ScheduleBoard";
import { groupSchedule, scheduleDay, schedulePhase } from "../lib/schedule-layout";
import { authClient } from "../../portal/lib/auth-client";
import type { PublicWorksResponse } from "../../shared/works";
import type { PortalDashboardResponse } from "../../shared/portal";
import { scheduleMissionStart } from "../lib/mission-time";
import { ObservatoryBackdrop } from "../components/observatory/ObservatoryBackdrop";
import { useDialogMotion } from "../components/use-dialog-motion";
import { PageSkeleton } from '../components/NavigationFeedback';

const dateFormat = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "long", day: "numeric" });
type OwnSchedule = { userId: string; segmentId: string | null; author: string | null };

// Keep only public data between visits; each mount still refreshes it. Account
// permissions and personal schedule state remain local to the current session.
let cachedPublicWorks: PublicWorksResponse | null = null;

export function WorksPage() {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  const [data, setData] = useState<PublicWorksResponse | null>(() => cachedPublicWorks);
  const [error, setError] = useState<string | null>(null);
  const [own, setOwn] = useState<OwnSchedule | null>(null);
  const [ownWarning, setOwnWarning] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [mobile, setMobile] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const { enter: enterDialog, exit: exitDialog, stop: stopDialog } = useDialogMotion(dialog);
  const detailTrigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      void requestJson<PublicWorksResponse>("/api/works", { signal: controller.signal })
        .then(response => {
          if (!controller.signal.aborted) {
            cachedPublicWorks = response;
            setData(response); setError(null); setNow(Date.now());
          }
        })
        .catch(caught => { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "暂时无法读取接力时间表。"); });
      if (userId) void requestJson<PortalDashboardResponse>("/api/portal/dashboard", { signal: controller.signal }).then(response => {
          if (!controller.signal.aborted) {
            setOwn({ userId, segmentId: response.currentSegment?.id ?? null, author: response.profile?.creditName ?? null });
            setOwnWarning(null);
          }
        })
        .catch(caught => {
          if (!controller.signal.aborted) {
            setOwn(null);
            setOwnWarning(caught instanceof ApiError && (caught.status === 401 || caught.status === 403)
              ? "暂时无法读取你的登录信息，可以重新进入作者页面。" : "暂时无法定位你的时段，公开排程仍可查看。");
          }
        });
    };
    refresh();
    const refreshTimer = window.setInterval(refresh, 60000);
    const clockTimer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => { controller.abort(); window.clearInterval(refreshTimer); window.clearInterval(clockTimer); };
  }, [userId]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 640px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const schedule = data?.schedule ?? [];
  const days = groupSchedule(schedule);
  const missionStart = scheduleMissionStart(schedule);
  const identity = own?.userId === userId ? own : null;
  const mine = schedule.find(entry => entry.id === identity?.segmentId);
  const mineId = mine?.id ?? null;
  const { phase, currentId } = schedulePhase(schedule, now);
  const selected = schedule.find(entry => entry.id === selectedId) ?? mine ?? schedule.find(entry => entry.id === currentId) ?? schedule[0];
  const hasSelected = Boolean(selected);
  const selectedKey = selected?.kind === 'extra' ? 'extra' : selected?.scheduledAt ? scheduleDay(selected.scheduledAt) : "pending";
  useEffect(() => {
    const element = dialog.current;
    if (!element) {
      setDetailOpen(false);
      return;
    }
    // Keep one detail component mounted while switching between inline and modal views.
    if (element.open) element.close();
    if (detailOpen) { element.showModal(); enterDialog(); }
    else if (!mobile) element.open = true;
    const previousOverflow = document.body.style.overflow;
    if (detailOpen) document.body.style.overflow = "hidden";
    return () => {
      stopDialog();
      element.style.removeProperty("opacity");
      element.style.removeProperty("transform");
      if (element.open) element.close();
      if (detailOpen) document.body.style.overflow = previousOverflow;
    };
  }, [mobile, detailOpen, selectedKey, hasSelected, enterDialog, stopDialog]);
  const count = (status: "available" | "confirmed" | "reserved" | "unavailable") => schedule.filter(entry => entry.status === status).length;
  const timedDays = days.filter(day => day.date);
  const firstDate = timedDays[0]?.date;
  const lastDate = timedDays.at(-1)?.date;

  function select(id: string) {
    detailTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedId(id);
    if (mobile || id === selected?.id) setDetailOpen(true);
  }
  function closeDetail() {
    exitDialog(() => {
      setDetailOpen(false);
      detailTrigger.current?.focus({ preventScroll: true });
    });
  }
  const detail = selected ? <ScheduleTaskDetail missionStart={missionStart} entry={selected} mine={selected.id === mineId} ownName={selected.id === mineId ? identity?.author ?? null : null}
    showcase signedIn={Boolean(userId)} ended={phase === "ended"} detailId={`ops-detail-${selectedKey}`} onClose={detailOpen ? closeDetail : undefined} actions={null} /> : null;

  return <div className="works-page works-page--schedule">
    <ObservatoryBackdrop />
    <header className="ops-page-heading">
      <div><h1>接力时间表</h1><ActivityIdentity /></div>
      <div className="ops-date-meta"><p>{firstDate ? <>{dateFormat.format(new Date(firstDate))}{lastDate && scheduleDay(firstDate) !== scheduleDay(lastDate) ? `—${dateFormat.format(new Date(lastDate))}` : ""}</> : "发布时间待定"}</p><span>UTC+8</span></div>
    </header>
    {error && <ReadError message={error} />}
    {!data ? !error && <PageSkeleton label="正在读取接力时间表" schedule /> : schedule.length === 0 ?
      <section className="works-empty"><ObservationMark /><h2>排期正在准备中</h2><p>排期公布后，可以在这里查看作者、空位和作品预告。</p></section> : <>
      <p className="ops-interaction-hint">{mobile ? "点击时段查看作者与作品。" : "选中详情显示在时间表下方，再次点击时段可展开完整简介。"}</p>
      {days.map(day => <ScheduleBoard key={day.key} missionStart={missionStart} day={day} selectedId={selected?.id ?? null} mineId={mineId} ownName={identity?.author ?? null} currentId={currentId} now={now} active={phase === "active"} onSelect={select} />)}
      {selected && <dialog ref={dialog} id="ops-slot-dialog" className={detailOpen ? "ops-detail-dialog" : "ops-inline-detail"} aria-label="时段详情"
          onCancel={event => { event.preventDefault(); closeDetail(); }} onClose={event => { if (!event.currentTarget.open) setDetailOpen(false); }}>
          {detail}
        </dialog>}
      <div className="ops-summary" role="status"><strong>{phase === "ended" ? "标准排程已结束" : phase === "active" ? "接力进行中" : "排程已公布"}</strong>
        <span><b>{count("confirmed")}</b><ScheduleStatus status="confirmed" /></span><span><b>{count("reserved")}</b><ScheduleStatus status="reserved" /></span><span><b>{count("available")}</b><ScheduleStatus status="available" /></span>
        {count("unavailable") > 0 && <span><b>{count("unavailable")}</b><ScheduleStatus status="unavailable" /></span>}
        {mine && <span className="ops-legend-mine">我的时段</span>}
      </div>
      {userId && ownWarning && <p className="ops-read-warning" role="status">{ownWarning}</p>}
    </>}
  </div>;
}
