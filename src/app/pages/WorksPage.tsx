import { Link, getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { requestJson } from "../lib/api";
import { ReadError } from "../components/ui";
import { ScrollReveal } from "../components/ScrollReveal";
import { ObservationMark, WorkCover, WorkTypeMark } from "../components/WorkPresentation";
import { workTypeLabels, type PublicWorksResponse } from "../../shared/works";

const route = getRouteApi("/works/");

export function WorksPage() {
  const { view, type, q } = route.useSearch();
  const navigate = route.useNavigate();
  const [data, setData] = useState<PublicWorksResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    requestJson<PublicWorksResponse>("/api/works", { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setData(response); })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "暂时无法读取观测集。"); });
    return () => controller.abort();
  }, []);
  const items = data?.items ?? [];
  const query = q.trim().toLocaleLowerCase();
  const visible = items.filter(work => (type === "all" || work.workType === type) &&
    `${work.previewTitle ?? ""} ${work.publicAuthorName ?? ""}`.toLocaleLowerCase().includes(query));
  const update = (next: Partial<{ view: "gallery" | "orbit"; type: string; q: string }>) =>
    void navigate({ search: current => ({ ...current, ...next }), replace: true });

  return <div className="works-page">
    <header className="works-intro">
      <div>
        <p className="eyebrow">HIFUU / OBSERVATION ARCHIVE</p>
        <h1>秘封观测集<span>沿着星轨，拾起每一份想象。</span></h1>
        <p>文字、画面与声音，在此相遇。循着接力的顺序，继续我们的共同观测。</p>
      </div>
      <div className="works-seal" aria-hidden="true"><ObservationMark /><span>STARWARD<br />VOL. 2026</span></div>
    </header>
    <div className="works-toolbar">
      <div className="works-view-switch" role="group" aria-label="浏览方式">
        <button type="button" aria-pressed={view === "gallery"} onClick={() => update({ view: "gallery" })}>作品墙</button>
        <button type="button" aria-pressed={view === "orbit"} onClick={() => update({ view: "orbit" })}>星轨接力</button>
      </div>
      <label className="works-search"><Search size={17} aria-hidden="true" /><span className="sr-only">搜索作品标题或作者</span><input type="search" value={q} placeholder="寻找标题或创作者" onChange={event => update({ q: event.target.value })} /></label>
    </div>
    {data && items.length > 0 && <div className="works-filters">
      <div className="works-types" role="group" aria-label="作品类型">
        <button type="button" aria-pressed={type === "all"} onClick={() => update({ type: "all" })}>全部 <small>{items.length}</small></button>
        {Object.entries(workTypeLabels).filter(([key]) => key === type || items.some(work => work.workType === key)).map(([key, label]) =>
          <button key={key} type="button" aria-pressed={type === key} onClick={() => update({ type: key })}>{label} <small>{items.filter(work => work.workType === key).length}</small></button>)}
      </div>
      <p role="status">{visible.length} 份观测 · 按接力顺序</p>
    </div>}
    {error ? <ReadError message={error} /> : !data ? <p className="works-empty" role="status">正在展开观测集…</p> : items.length === 0 ?
      <section className="works-empty"><ObservationMark /><h2>下一份观测，正在酝酿。</h2><p>作品公开后，会在这里依次相遇。</p><Link to="/apply" className="text-link">了解创作接力 <ArrowUpRight size={16} /></Link></section> : visible.length === 0 ?
      <section className="works-empty"><h2>还没有找到这份观测。</h2><p>试试其他标题、作者或作品类型。</p><button className="button button--secondary" type="button" onClick={() => update({ q: "", type: "all" })}>查看全部作品</button></section> : <>
        {view === "orbit" && <nav className="works-orbit" aria-label="接力顺序导航">{visible.map(work =>
          <a key={work.id} href={`#observation-${work.id}`}><span className="orbit-point" /><small>OBS. {String(work.observationNumber).padStart(2, "0")}</small><strong>{work.previewTitle}</strong><span>{work.segmentName || "自由观测"}</span></a>)}</nav>}
        <div className={`works-grid${view === "orbit" ? " works-grid--sequence" : ""}`}>
          {visible.map(work => <ScrollReveal key={work.id}>
            <article id={`observation-${work.id}`} className="work-card">
              <Link to="/works/$workId" params={{ workId: work.id }} className="work-card-link">
                <div className="work-card-index"><span>OBS. {String(work.observationNumber).padStart(2, "0")}</span><span>{work.segmentName || "自由观测"}</span></div>
                <WorkCover work={work} />
                <div className="work-card-caption"><div><WorkTypeMark type={work.workType} /><h2>{work.previewTitle}</h2><p>{work.publicAuthorName}</p></div><ArrowUpRight size={22} aria-hidden="true" /></div>
                <span className="sr-only">查看作品详情</span>
              </Link>
            </article>
          </ScrollReveal>)}
        </div>
        <footer className="works-end"><span />共同观测，仍在继续。<span /></footer>
      </>}
  </div>;
}
