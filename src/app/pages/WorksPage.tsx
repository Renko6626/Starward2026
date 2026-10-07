import { Link, getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { requestJson } from "../lib/api";
import { ReadError } from "../components/ui";
import { ObservationMark, WorkTypeMark } from "../components/WorkPresentation";
import type { PublicScheduleEntry, PublicWorksResponse } from "../../shared/works";

const route = getRouteApi("/works/");
const dateFormat = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "long", day: "numeric" });
const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" });
const weekdayFormat = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", weekday: "long" });

function groupByDate(entries: PublicScheduleEntry[]) {
  const groups = new Map<string, { key: string; date: Date | null; entries: PublicScheduleEntry[] }>();
  for (const entry of entries) {
    const date = entry.scheduledAt ? new Date(entry.scheduledAt) : null;
    const key = date ? dayFormat.format(date) : "pending";
    if (!groups.has(key)) groups.set(key, { key, date, entries: [] });
    groups.get(key)!.entries.push(entry);
  }
  return [...groups.values()];
}
const timeFormat = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export function WorksPage() {
  const { q, view, type } = route.useSearch();
  const navigate = route.useNavigate();
  const [data, setData] = useState<PublicWorksResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => requestJson<PublicWorksResponse>("/api/works", { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) { setData(response); setError(null); setNow(Date.now()); } })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "暂时无法读取接力时间表。"); });
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 60000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, []);
  const schedule = data?.schedule ?? [];
  const query = q.trim().toLocaleLowerCase();
  const visible = schedule.filter(entry => `${entry.preview?.previewTitle ?? ""} ${entry.publicAuthorName ?? ""}`.toLocaleLowerCase().includes(query));
  const timed = schedule.filter(entry => entry.scheduledAt);
  const started = timed.some(entry => Date.parse(entry.scheduledAt!) <= now);
  const ended = timed.length === schedule.length && timed.length > 0 && timed.every(entry => Date.parse(entry.scheduledAt!) <= now);
  const currentId = started && !ended ? [...timed].reverse().find(entry => Date.parse(entry.scheduledAt!) <= now)?.id : null;

  const groups = groupByDate(visible);
  const currentIndex = schedule.findIndex(entry => entry.id === currentId);
  const announced = schedule.filter(entry => entry.preview).length;
  const firstDate = timed[0]?.scheduledAt;
  const lastDate = timed[timed.length - 1]?.scheduledAt;

  return <div className="works-page works-page--schedule">
    <header className="schedule-page-heading">
      <h1>接力时间表</h1>
      {firstDate && <p>{dateFormat.format(new Date(firstDate))}{lastDate && dayFormat.format(new Date(firstDate)) !== dayFormat.format(new Date(lastDate)) ? `—${dateFormat.format(new Date(lastDate))}` : ""}</p>}
      <span>北京时间 UTC+8</span>
    </header>
    {schedule.length > 0 && <div className="relay-progress">
      <div className="relay-progress-caption">
        <span>{ended ? "接力已结束" : currentIndex >= 0 ? <>当前接力 <strong>{schedule[currentIndex]?.code}</strong> / {schedule.length}</> : <>接力预告 / {schedule.length} 棒</>}</span>
        {currentId && <Link to="/works" search={{ view, type, q: "" }} hash={`relay-${currentId}`}>定位当前接力</Link>}
      </div>
      <div className="relay-progress-ticks" style={{ gridTemplateColumns: `repeat(${schedule.length}, minmax(0, 1fr))` }} aria-hidden="true">
        {schedule.map(entry => <i key={entry.id} className={entry.id === currentId ? "is-current" : entry.scheduledAt && Date.parse(entry.scheduledAt) <= now ? "is-past" : ""} />)}
      </div>
    </div>}
    <div className="works-toolbar">
      <div className="relay-summary" role="status"><strong>{ended ? "接力已结束" : started ? "接力进行中" : "接力预告"}</strong><span>共 {schedule.length} 棒</span><span>预告已公布 {announced} 棒</span></div>
      <label className="works-search"><Search size={15} aria-hidden="true" /><span className="sr-only">搜索作品标题或参与者</span><input type="search" value={q} placeholder="寻找作品或参与者" onChange={event => void navigate({ search: current => ({ ...current, q: event.target.value }), replace: true })} /></label>
    </div>
    {error ? <ReadError message={error} /> : !data ? <p className="works-empty" role="status">正在读取接力时间表…</p> : schedule.length === 0 ?
      <section className="works-empty"><ObservationMark /><h2>排期正在准备中</h2><p>发布时点确认后，会在这里展示参与者和作品预告。</p></section> : visible.length === 0 ?
      <section className="works-empty"><h2>没有找到对应作品或参与者</h2><button className="button button--secondary" type="button" onClick={() => void navigate({ search: current => ({ ...current, q: "" }), replace: true })}>查看完整时间表</button></section> : <>
      <nav className="relay-date-nav" aria-label="按日期查看接力">
        <span>按日期查看</span>
        {groups.map(group => <a key={group.key} href={`#relay-day-${group.key}`}>{group.date ? dateFormat.format(group.date) : "时间待定"}<small>{group.entries.length} 棒</small></a>)}
        <p>作品详情在接力结束后开放</p>
      </nav>
      <div className="relay-days">
        {groups.map(group => <section key={group.key} className="relay-day" id={`relay-day-${group.key}`} aria-labelledby={`relay-heading-${group.key}`}>
          <header className="relay-day-heading">
            <h2 id={`relay-heading-${group.key}`}>{group.date ? <><span>{group.date.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai", month: "long" })}</span><strong>{group.date.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai", day: "numeric" }).replace("日", "")}</strong><span>{weekdayFormat.format(group.date)}</span></> : "时间待定"}</h2>
            <span>{group.entries.length} 棒</span>
          </header>
          <ol className="relay-timetable" aria-label={`${group.date ? dateFormat.format(group.date) : "时间待定"}作品发布顺序`}>
            {group.entries.map(entry => <li key={entry.id} id={`relay-${entry.id}`} className={`relay-row${entry.id === currentId ? " relay-row--current" : ""}`}>
              <div className="relay-time">
                {entry.scheduledAt ? <time dateTime={entry.scheduledAt}><strong>{timeFormat.format(new Date(entry.scheduledAt))}</strong></time> : <strong className="relay-time-pending">时间待定</strong>}
                <span className="relay-number">第 {entry.code} 棒</span>
                <span className={entry.id === currentId ? "relay-current" : "relay-slot-state"}>{entry.id === currentId ? "当前接力" : entry.scheduledAt && Date.parse(entry.scheduledAt) <= now ? "已到发布时点" : "后续接力"}</span>
              </div>
              <div className="relay-preview">
                <div className="relay-copy">
                  <h3>{entry.workId ? <Link to="/works/$workId" params={{ workId: entry.workId }}>{entry.preview?.previewTitle || "查看作品"}<ArrowUpRight size={13} aria-hidden="true" /></Link> : entry.preview?.previewTitle || "作品预告待公布"}</h3>
                  <div className="relay-byline"><p className="relay-author">{entry.publicAuthorName || "参与者待公布"}</p>{entry.preview?.workType && <WorkTypeMark type={entry.preview.workType} />}</div>
                  {ended && !entry.workId && <span className="relay-pending">作品待公开</span>}
                </div>
                {entry.preview?.coverUrl && <img className="relay-cover" src={entry.preview.coverUrl} alt={entry.preview.coverAlt || `${entry.preview.previewTitle ?? "作品"}预览`} loading="lazy" decoding="async" referrerPolicy="no-referrer" />}
              </div>
            </li>)}
          </ol>
        </section>)}
      </div>
      <p className="relay-list-end">{query ? `找到 ${visible.length} 棒` : `全部 ${schedule.length} 棒`}</p>
    </>}
  </div>;
}
