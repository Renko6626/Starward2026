import { Link, getRouteApi } from "@tanstack/react-router";
import { Fragment, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { ApiError, requestJson } from "../lib/api";
import { Notice, ReadError } from "../components/ui";
import { ObservationMark } from "../components/WorkPresentation";
import { ScheduleBoard, ScheduleStatus, ScheduleTaskDetail, scheduleAuthor } from "../components/ScheduleBoard";
import { groupSchedule, scheduleDay, schedulePhase } from "../lib/schedule-layout";
import { authClient } from "../../portal/lib/auth-client";
import type { PublicWorksResponse } from "../../shared/works";
import type { PortalDashboardResponse } from "../../shared/portal";
import type { CollaborationResponse } from "../../shared/collaboration";
import { ScheduleSection } from "../../portal/components/ScheduleSection";

const route = getRouteApi("/works/");
const dateFormat = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "long", day: "numeric" });
type OwnSchedule = { userId: string; revision: number; segmentId: string | null; author: string | null; status: string | undefined; collaboration: CollaborationResponse };

export function WorksPage() {
  const { q } = route.useSearch();
  const navigate = route.useNavigate();
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
  const identity = own && own.userId === userId && own.revision === revision ? own : null;
  const mine = schedule.find(entry => entry.id === identity?.segmentId);
  const mineId = mine?.id ?? null;
  const { phase, currentId } = schedulePhase(schedule, now);
  const selected = schedule.find(entry => entry.id === selectedId) ?? mine ?? schedule.find(entry => entry.id === currentId) ?? schedule[0];
  const selectedKey = selected?.scheduledAt ? scheduleDay(selected.scheduledAt) : "pending";
  const query = q.trim().toLocaleLowerCase();
  const matched = query ? new Set(schedule.filter(entry => `${scheduleAuthor(entry, entry.id === mineId ? identity?.author : null)} ${entry.preview?.previewTitle ?? ""} ${entry.code} ${entry.id === mineId ? "我的" : ""}`.toLocaleLowerCase().includes(query)).map(entry => entry.id)) : null;
  const count = (status: "available" | "confirmed" | "reserved" | "unavailable") => schedule.filter(entry => entry.status === status).length;
  const timedDays = days.filter(day => day.date);
  const firstDate = timedDays[0]?.date;
  const lastDate = timedDays.at(-1)?.date;

  function select(id: string) {
    detailTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedId(id);
    if (mobile) setDetailOpen(true);
  }
  function closeDetail() {
    setDetailOpen(false);
    detailTrigger.current?.focus({ preventScroll: true });
  }
  function locate(id: string) {
    select(id);
    void navigate({ search: current => ({ ...current, q: "" }), hash: `relay-${id}`, replace: true });
  }
  const actions = selected && userId ? !identity ? <p>正在读取操作权限。{ownWarning}</p>
    : identity.status === "approved" ? <ScheduleSection key={selected.id} collaboration={identity.collaboration} selectedSegmentId={selected.id} revision={revision} onResult={text => setOperationMessage({ userId, text })} onSaved={async () => { setRevision(value => value + 1); }} />
    : identity.status === "completed" ? <Link to="/portal">查看我的参与记录</Link>
    : selected.status === "available" || selected.id === mineId ? <Link to="/portal" search={{ segment: selected.id }} hash="plan">{selected.id === mineId ? "管理我的报名" : "选择这个时点并填写报名"}</Link> : null : undefined;
  const detail = selected ? <ScheduleTaskDetail entry={selected} mine={selected.id === mineId} ownName={selected.id === mineId ? identity?.author ?? null : null}
    signedIn={Boolean(userId)} ended={phase === "ended"} detailId={`ops-detail-${selectedKey}`} actions={actions} /> : null;

  return <div className="works-page works-page--schedule">
    <header className="ops-page-heading">
      <div><h1>接力时间表</h1><span lang="en">OPERATIONS SCHEDULE</span></div>
      <div className="ops-date-meta"><p>{firstDate ? <>{dateFormat.format(new Date(firstDate))}{lastDate && scheduleDay(firstDate) !== scheduleDay(lastDate) ? `—${dateFormat.format(new Date(lastDate))}` : ""}</> : "发布时间待定"}</p><span>北京时间 UTC+8</span></div>
    </header>
    {error && <ReadError message={error} />}
    {operationMessage && operationMessage.userId === userId ? <Notice tone="success">{operationMessage.text} <Link to="/portal" hash="tasks">查看我的请求与反馈</Link></Notice> : null}
    {!data ? !error && <p className="works-empty" role="status">正在读取接力时间表…</p> : schedule.length === 0 ?
      <section className="works-empty"><ObservationMark /><h2>排期正在准备中</h2><p>排期公布后，可以在这里查看作者、空位和作品预告。</p></section> : <>
      <div className="ops-summary" role="status"><strong>{phase === "ended" ? "接力已结束" : phase === "active" ? "接力进行中" : "排程已公布"}</strong>
        <span><b>{count("confirmed")}</b>已确认</span><span><b>{count("reserved")}</b>已预留</span><span><b>{count("available")}</b>待认领</span>
        {count("unavailable") > 0 && <span><b>{count("unavailable")}</b>不可选择</span>}
        <p>提交后预留，审核通过后确认</p>
      </div>
      <div className="ops-toolbar">
        <div className="ops-locations">
          {mine && <button type="button" className="ops-my-location" onClick={() => locate(mine.id)}>定位我的时段 <span>{mine.code}</span></button>}
          {currentId && <button type="button" onClick={() => locate(currentId)}>定位当前接力</button>}
          {days.length > 1 && <nav aria-label="按日期查看接力">{days.map(day => <a key={day.key} href={`#relay-day-${day.key}`}>{day.date ? dateFormat.format(new Date(day.date)) : "时间待定"}</a>)}</nav>}
        </div>
        <label className="ops-search"><Search size={14} aria-hidden="true" /><span className="sr-only">搜索作者或作品</span><input type="search" value={q} placeholder="寻找作者或作品" onChange={event => void navigate({ search: current => ({ ...current, q: event.target.value }), replace: true })} /></label>
      </div>
      {userId && ownWarning && <p className="ops-read-warning" role="status">{ownWarning}</p>}
      <div className="ops-legend"><div><ScheduleStatus status="confirmed" /><ScheduleStatus status="reserved" /><ScheduleStatus status="available" />{mine && <span className="ops-legend-mine">我的时段</span>}</div><p>{query ? <>找到 {matched?.size ?? 0} 个时段，完整排程仍保留。 <button type="button" onClick={() => void navigate({ search: current => ({ ...current, q: "" }), replace: true })}>清除搜索</button></> : "点击时段查看作者与作品"}</p></div>
      {days.map(day => <Fragment key={day.key}>
        <ScheduleBoard day={day} selectedId={selected?.id ?? null} mineId={mineId} ownName={identity?.author ?? null} currentId={currentId} now={now} active={phase === "active"} matches={matched} onSelect={select} />
        {!mobile && selectedKey === day.key && detail}
      </Fragment>)}
      {mobile && selected && <dialog ref={dialog} className="ops-detail-dialog" aria-label="选中时段详情" onCancel={event => { event.preventDefault(); closeDetail(); }} onClose={() => setDetailOpen(false)}>
        <ScheduleTaskDetail entry={selected} mine={selected.id === mineId} ownName={selected.id === mineId ? identity?.author ?? null : null} signedIn={Boolean(userId)} ended={phase === "ended"} detailId={`ops-detail-${selectedKey}`} onClose={closeDetail} actions={actions} />
      </dialog>}
      <div className="ops-page-foot"><p>共 {schedule.length} 棒。作品详情在接力结束后开放。</p><Link to={userId ? "/portal" : "/portal/login"} hash={userId ? "plan" : undefined}>前往创作者工作台</Link></div>
    </>}
  </div>;
}
