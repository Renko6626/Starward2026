import { Link, getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { requestJson } from "../lib/api";
import { ReadError } from "../components/ui";
import { ObservationMark, WorkTypeMark } from "../components/WorkPresentation";
import type { PublicWorksResponse } from "../../shared/works";

const route = getRouteApi("/works/");
const dateFormat = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" });
const timeFormat = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export function WorksPage() {
  const { q } = route.useSearch();
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

  return <div className="works-page">
    <header className="works-intro">
      <div>
        <p className="eyebrow">STARWARD 2026</p>
        <h1>接力时间表<span>每一棒，在约定的时刻相遇。</span></h1>
        <p>按发布时间查看参与者与作品预告。接力结束后，已公开的作品可以进入详情查看。</p>
      </div>
      <div className="works-seal" aria-hidden="true"><ObservationMark /><span>STARWARD<br />VOL. 2026</span></div>
    </header>
    <div className="works-toolbar">
      <div className="relay-summary" role="status"><strong>{ended ? "接力已结束" : started ? "接力进行中" : "接力预告"}</strong><span>{schedule.length} 棒</span><span>北京时间 UTC+8</span></div>
      <label className="works-search"><Search size={17} aria-hidden="true" /><span className="sr-only">搜索作品标题或参与者</span><input type="search" value={q} placeholder="寻找标题或参与者" onChange={event => void navigate({ search: current => ({ ...current, q: event.target.value }), replace: true })} /></label>
    </div>
    {error ? <ReadError message={error} /> : !data ? <p className="works-empty" role="status">正在读取接力时间表…</p> : schedule.length === 0 ?
      <section className="works-empty"><ObservationMark /><h2>排期正在准备中</h2><p>发布时点确认后，会在这里展示参与者和作品预告。</p></section> : visible.length === 0 ?
      <section className="works-empty"><h2>没有找到对应作品或参与者</h2><button className="button button--secondary" type="button" onClick={() => void navigate({ search: current => ({ ...current, q: "" }), replace: true })}>查看完整时间表</button></section> :
      <ol className="relay-timetable" aria-label="作品发布顺序">
        {visible.map(entry => <li key={entry.id} className={`relay-row${entry.id === currentId ? " relay-row--current" : ""}`}>
          <div className="relay-time">
            <span className="relay-number">第 {entry.code} 棒</span>
            {entry.scheduledAt ? <time dateTime={entry.scheduledAt}><strong>{timeFormat.format(new Date(entry.scheduledAt))}</strong><span>{dateFormat.format(new Date(entry.scheduledAt))}</span></time> : <strong>时间待定</strong>}
            {entry.id === currentId && <span className="relay-current">当前接力</span>}
          </div>
          <div className="relay-preview">
            {entry.preview?.coverUrl && <img className="relay-cover" src={entry.preview.coverUrl} alt={entry.preview.coverAlt || `${entry.preview.previewTitle ?? "作品"}预览`} loading="lazy" decoding="async" referrerPolicy="no-referrer" />}
            <div className="relay-copy">
              <p className="relay-author">{entry.publicAuthorName || "参与者待公布"}</p>
              <h2>{entry.preview?.previewTitle || "作品预告待公布"}</h2>
              {entry.preview && <WorkTypeMark type={entry.preview.workType} />}
              <p className="relay-description">{entry.preview?.previewSummary || "此处保留作品坑位，预告审核通过后展示。"}</p>
              {entry.workId ? <Link className="text-link" to="/works/$workId" params={{ workId: entry.workId }}>查看作品 <ArrowUpRight size={16} /></Link> : <span className="relay-pending">{ended ? "作品待公开" : "接力结束后开放作品详情"}</span>}
            </div>
          </div>
        </li>)}
      </ol>}
  </div>;
}
