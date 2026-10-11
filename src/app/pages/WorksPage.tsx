import { useSiteTranslation } from "../../i18n/use-site-translation";
import { Link } from "@tanstack/react-router";
import { Fragment, useEffect, useRef, useState } from "react";
import { ApiError, requestJson } from "../lib/api";
import { Notice, ReadError } from "../components/ui";
import { ObservationMark } from "../components/WorkPresentation";
import { ActivityIdentity } from "../components/ActivityIdentity";
import { ScheduleBoard, ScheduleStatus, ScheduleTaskDetail } from "../components/ScheduleBoard";
import { groupSchedule, scheduleDay, schedulePhase } from "../lib/schedule-layout";
import { authClient } from "../../portal/lib/auth-client";
import type { PublicWorksResponse } from "../../shared/works";
import type { PortalDashboardResponse } from "../../shared/portal";
import type { CollaborationResponse } from "../../shared/collaboration";
import { scheduleMissionStart } from "../lib/mission-time";
import { ScheduleSection } from "../../portal/components/ScheduleSection";
import { readScheduleIntent, saveScheduleIntent } from "../../portal/lib/schedule-selection";
import { ObservatoryBackdrop } from "../components/observatory/ObservatoryBackdrop";
import { useDialogMotion } from "../components/use-dialog-motion";
import { PageSkeleton } from '../components/NavigationFeedback';

type OwnSchedule = { userId: string; revision: number; segmentId: string | null; author: string | null; status: string | undefined; collaboration: CollaborationResponse };

// Keep only public data between visits; each mount still refreshes it. Account
// permissions and personal schedule state remain local to the current session.
let cachedPublicWorks: PublicWorksResponse | null = null;

export function WorksPage() {
  const { t, language } = useSiteTranslation();
  const dateFormat = new Intl.DateTimeFormat(language, { timeZone: "Asia/Shanghai", month: "long", day: "numeric" });
  const timeFormat = new Intl.DateTimeFormat(language, { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  const [data, setData] = useState<PublicWorksResponse | null>(() => cachedPublicWorks);
  const [error, setError] = useState<string | null>(null);
  const [own, setOwn] = useState<OwnSchedule | null>(null);
  const [ownWarning, setOwnWarning] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [operationMessage, setOperationMessage] = useState<{ userId: string; text: string } | null>(null);
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
        .catch(caught => { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : t("public.schedule.readError")); });
      if (userId) void Promise.all([
        requestJson<PortalDashboardResponse>("/api/portal/dashboard", { signal: controller.signal }),
        requestJson<CollaborationResponse>("/api/portal/collaboration", { signal: controller.signal }),
      ]).then(([response, collaboration]) => {
          if (!controller.signal.aborted) {
            setOwn({ userId, revision, segmentId: response.currentSegment?.id ?? null, status: response.participant?.status, collaboration, author: response.profile
              ? response.profile.isAnonymous ? t("public.schedule.anonymous") : response.profile.creditName : null });
            setOwnWarning(null);
          }
        })
        .catch(caught => {
          if (!controller.signal.aborted) {
            setOwn(null);
            setOwnWarning(caught instanceof ApiError && (caught.status === 401 || caught.status === 403)
              ? t("public.schedule.sessionError") : t("public.schedule.ownError"));
          }
        });
    };
    refresh();
    const refreshTimer = window.setInterval(refresh, 60000);
    const clockTimer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => { controller.abort(); window.clearInterval(refreshTimer); window.clearInterval(clockTimer); };
  }, [userId, revision, language]);

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
  const identity = own && own.userId === userId && own.revision === revision ? own : null;
  useEffect(() => {
    if (!userId || !identity || identity.status === "approved" || identity.status === "completed") return;
    const intent = readScheduleIntent(userId);
    if (intent && schedule.some(entry => entry.id === intent && entry.status === "available")) {
      setSelectedId(current => current ?? intent);
    }
  }, [userId, identity, schedule]);
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
  const actions = selected && userId ? !identity ? <p>{t("public.schedule.permissions")}{ownWarning}</p>
    : identity.status === "approved" ? <ScheduleSection key={selected.id} collaboration={identity.collaboration} selectedSegmentId={selected.id} revision={revision} onResult={text => setOperationMessage({ userId, text })} onSaved={async () => { setRevision(value => value + 1); }} />
    : identity.status === "completed" ? <Link to="/portal">{t("public.schedule.record")}</Link>
    : selected.status === "available" || selected.id === mineId ? <Link to="/portal" search={{ segment: selected.id }} hash={selected.id === mineId ? "plan" : "profile"}
      onClick={() => saveScheduleIntent(userId, selected.id)}>{selected.id === mineId ? t("public.schedule.manage") : t("public.schedule.selectApply")}</Link> : null : undefined;
  const detail = selected ? <ScheduleTaskDetail missionStart={missionStart} entry={selected} mine={selected.id === mineId} ownName={selected.id === mineId ? identity?.author ?? null : null}
    signedIn={Boolean(userId)} ended={phase === "ended"} detailId={`ops-detail-${selectedKey}`} onClose={detailOpen ? closeDetail : undefined} actions={actions} /> : null;

  return <div className="works-page works-page--schedule">
    <ObservatoryBackdrop />
    <header className="ops-page-heading">
      <div><h1>{t("public.schedule.title")}</h1><ActivityIdentity /></div>
      <div className="ops-date-meta"><p>{firstDate ? <>{dateFormat.format(new Date(firstDate))}{lastDate && scheduleDay(firstDate) !== scheduleDay(lastDate) ? `—${dateFormat.format(new Date(lastDate))}` : ""}</> : t("public.schedule.pending")}</p><span>UTC+8</span></div>
    </header>
    {identity && identity.status !== "approved" && identity.status !== "completed" ? <Notice>{t("public.schedule.pickNotice")}</Notice> : null}
    {error && <ReadError message={error} />}
    {operationMessage && operationMessage.userId === userId ? <Notice tone="success">{operationMessage.text} <Link to="/portal" hash="tasks">{t("public.schedule.requests")}</Link></Notice> : null}
    {!data ? !error && <PageSkeleton label={t("public.schedule.loading")} schedule /> : schedule.length === 0 ?
      <section className="works-empty"><ObservationMark /><h2>{t("public.schedule.preparing")}</h2><p>{t("public.schedule.preparingNote")}</p></section> : <>
      <p className="ops-interaction-hint">{mobile ? t("public.schedule.mobileHint") : t("public.schedule.desktopHint")}</p>
      {days.map(day => <Fragment key={day.key}>
        <ScheduleBoard missionStart={missionStart} day={day} selectedId={selected?.id ?? null} mineId={mineId} ownName={identity?.author ?? null} currentId={currentId} now={now} active={phase === "active"} onSelect={select} />
        {selectedKey === day.key && <dialog ref={dialog} id="ops-slot-dialog" className={detailOpen ? "ops-detail-dialog" : "ops-inline-detail"} aria-label={t("public.schedule.dialog")}
          onCancel={event => { event.preventDefault(); closeDetail(); }} onClose={event => { if (!event.currentTarget.open) setDetailOpen(false); }}>
          {detail}
        </dialog>}
      </Fragment>)}
      <div className="ops-summary" role="status"><strong>{phase === "ended" ? t("public.schedule.ended") : phase === "active" ? t("public.schedule.active") : t("public.schedule.published")}</strong>
        <span><b>{count("confirmed")}</b><ScheduleStatus status="confirmed" /></span><span><b>{count("reserved")}</b><ScheduleStatus status="reserved" /></span><span><b>{count("available")}</b><ScheduleStatus status="available" /></span>
        {count("unavailable") > 0 && <span><b>{count("unavailable")}</b><ScheduleStatus status="unavailable" /></span>}
        {mine && <span className="ops-legend-mine">{t("public.schedule.mine")}</span>}
      </div>
      {userId && ownWarning && <p className="ops-read-warning" role="status">{ownWarning}</p>}
      <div className="ops-page-foot"><Link to={userId ? "/portal" : "/portal/login"} search={{ segment: "" }} onClick={() => { if (userId) saveScheduleIntent(userId, ""); }}>{t("public.schedule.noTime")}</Link><p>{missionStart !== null && <>{t("public.schedule.missionStart", { date: dateFormat.format(new Date(missionStart)), time: timeFormat.format(new Date(missionStart)) })}</>}{t("public.schedule.footnote", { count: schedule.length })}</p><Link to={userId ? "/portal" : "/portal/login"} hash={userId ? "plan" : undefined}>{t("public.schedule.workspace")}</Link></div>
    </>}
  </div>;
}
