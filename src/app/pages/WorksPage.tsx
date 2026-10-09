import { Link } from "@tanstack/react-router";
import { Fragment, useEffect, useRef, useState } from "react";
import { ApiError, requestJson } from "../lib/api";
import { Notice, ReadError } from "../components/ui";
import { ObservationMark } from "../components/WorkPresentation";
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

const dateFormat = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "long", day: "numeric" });
const timeFormat = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
type OwnSchedule = { userId: string; revision: number; segmentId: string | null; author: string | null; status: string | undefined; collaboration: CollaborationResponse };

export function WorksPage() {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  const [data, setData] = useState<PublicWorksResponse | null>(null);
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
  const detailTrigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      void requestJson<PublicWorksResponse>("/api/works", { signal: controller.signal })
        .then(response => { if (!controller.signal.aborted) { setData(response); setError(null); setNow(Date.now()); } })
        .catch(caught => { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "暂时无法读取接力时间表。"); });
      if (userId) void Promise.all([
        requestJson<PortalDashboardResponse>("/api/portal/dashboard", { signal: controller.signal }),
        requestJson<CollaborationResponse>("/api/portal/collaboration", { signal: controller.signal }),
      ]).then(([response, collaboration]) => {
          if (!controller.signal.aborted) {
            setOwn({ userId, revision, segmentId: response.currentSegment?.id ?? null, status: response.participant?.status, collaboration, author: response.profile
              ? response.profile.isAnonymous ? "匿名" : response.profile.creditName : null });
            setOwnWarning(null);
          }
        })
        .catch(caught => {
          if (!controller.signal.aborted) {
            setOwn(null);
            setOwnWarning(caught instanceof ApiError && (caught.status === 401 || caught.status === 403)
              ? "暂时无法读取你的登录信息，可以重新进入创作者工作台。" : "暂时无法定位你的时段，公开排程仍可查看。");
          }
        });
    };
    refresh();
    const refreshTimer = window.setInterval(refresh, 60000);
    const clockTimer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => { controller.abort(); window.clearInterval(refreshTimer); window.clearInterval(clockTimer); };
  }, [userId, revision]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 640px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!data?.schedule.length) {
      setDetailOpen(false);
      return;
    }
    const element = dialog.current;
    if (!mobile || !detailOpen || !element) return;
    element.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { if (element.open) element.close(); document.body.style.overflow = previousOverflow; };
  }, [mobile, detailOpen, data?.schedule.length]);

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
  const selectedKey = selected?.kind === 'extra' ? 'extra' : selected?.scheduledAt ? scheduleDay(selected.scheduledAt) : "pending";
  const count = (status: "available" | "confirmed" | "reserved" | "unavailable") => schedule.filter(entry => entry.status === status).length;
  const timedDays = days.filter(day => day.date);
  const firstDate = timedDays[0]?.date;
  const lastDate = timedDays.at(-1)?.date;

  function select(id: string) {
    detailTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedId(id);
    if (userId && identity && identity.status !== "approved" && identity.status !== "completed"
      && schedule.some(entry => entry.id === id && entry.status === "available")) {
      saveScheduleIntent(userId, id);
    }
    if (mobile) setDetailOpen(true);
  }
  function closeDetail() {
    setDetailOpen(false);
    detailTrigger.current?.focus({ preventScroll: true });
  }
  const actions = selected && userId ? !identity ? <p>正在读取操作权限。{ownWarning}</p>
    : identity.status === "approved" ? <ScheduleSection key={selected.id} collaboration={identity.collaboration} selectedSegmentId={selected.id} revision={revision} onResult={text => setOperationMessage({ userId, text })} onSaved={async () => { setRevision(value => value + 1); }} />
    : identity.status === "completed" ? <Link to="/portal">查看我的参与记录</Link>
    : selected.status === "available" || selected.id === mineId ? <Link to="/portal" search={{ segment: selected.id }} hash={selected.id === mineId ? "plan" : "profile"}
      onClick={() => saveScheduleIntent(userId, selected.id)}>{selected.id === mineId ? "管理我的报名" : "选择这个时点并填写报名"}</Link> : null : undefined;
  const detail = selected ? <ScheduleTaskDetail missionStart={missionStart} entry={selected} mine={selected.id === mineId} ownName={selected.id === mineId ? identity?.author ?? null : null}
    signedIn={Boolean(userId)} ended={phase === "ended"} detailId={`ops-detail-${selectedKey}`} actions={actions} /> : null;

  return <div className="works-page works-page--schedule">
    <ObservatoryBackdrop />
    <header className="ops-page-heading">
      <div><h1>接力时间表</h1></div>
      <div className="ops-date-meta"><p>{firstDate ? <>{dateFormat.format(new Date(firstDate))}{lastDate && scheduleDay(firstDate) !== scheduleDay(lastDate) ? `—${dateFormat.format(new Date(lastDate))}` : ""}</> : "发布时间待定"}</p><span>UTC+8</span></div>
    </header>
    {identity && identity.status !== "approved" && identity.status !== "completed" ? <Notice>先选择一个空闲时点，再进入工作台填写报名资料。意向时间保存在当前浏览器标签页，提交报名成功后才会预留。</Notice> : null}
    {error && <ReadError message={error} />}
    {operationMessage && operationMessage.userId === userId ? <Notice tone="success">{operationMessage.text} <Link to="/portal" hash="tasks">查看我的请求与反馈</Link></Notice> : null}
    {!data ? !error && <p className="works-empty" role="status">正在读取接力时间表…</p> : schedule.length === 0 ?
      <section className="works-empty"><ObservationMark /><h2>排期正在准备中</h2><p>排期公布后，可以在这里查看作者、空位和作品预告。</p></section> : <>
      {days.map(day => <Fragment key={day.key}>
        <ScheduleBoard missionStart={missionStart} day={day} selectedId={selected?.id ?? null} mineId={mineId} ownName={identity?.author ?? null} currentId={currentId} now={now} active={phase === "active"} onSelect={select} />
        {!mobile && selectedKey === day.key && detail}
      </Fragment>)}
      {mobile && selected && <dialog ref={dialog} className="ops-detail-dialog" aria-label="选中时段详情" onCancel={event => { event.preventDefault(); closeDetail(); }} onClose={() => setDetailOpen(false)}>
        <ScheduleTaskDetail missionStart={missionStart} entry={selected} mine={selected.id === mineId} ownName={selected.id === mineId ? identity?.author ?? null : null} signedIn={Boolean(userId)} ended={phase === "ended"} detailId={`ops-detail-${selectedKey}`} onClose={closeDetail} actions={actions} />
      </dialog>}
      <div className="ops-summary" role="status"><strong>{phase === "ended" ? "标准排程已结束" : phase === "active" ? "接力进行中" : "排程已公布"}</strong>
        <span><b>{count("confirmed")}</b><ScheduleStatus status="confirmed" /></span><span><b>{count("reserved")}</b><ScheduleStatus status="reserved" /></span><span><b>{count("available")}</b><ScheduleStatus status="available" /></span>
        {count("unavailable") > 0 && <span><b>{count("unavailable")}</b><ScheduleStatus status="unavailable" /></span>}
        {mine && <span className="ops-legend-mine">我的时段</span>}
      </div>
      {userId && ownWarning && <p className="ops-read-warning" role="status">{ownWarning}</p>}
      <div className="ops-page-foot"><p>{missionStart !== null && <>任务计时从首个发布时刻起算（{dateFormat.format(new Date(missionStart))} {timeFormat.format(new Date(missionStart))} UTC+8）。</>}共 {schedule.length} 棒。提交后预留，审核通过后确认。由作者按约定时段发布作品，并回到工作台填写链接、确认已发布。作者确认发布且资料审核通过后，作品详情会在站内公开。</p><Link to={userId ? "/portal" : "/portal/login"} hash={userId ? "plan" : undefined}>前往创作者工作台</Link></div>
    </>}
  </div>;
}
