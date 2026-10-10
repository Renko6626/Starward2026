import { ArrowUpRight, BookOpen, Film, Headphones, Orbit, Palette, PanelsTopLeft, Drama } from "lucide-react";
import { workTypeLabels, type WorkPresentation as WorkData, type WorkType } from "../../shared/works";
import "./works.css";
import "./ui/buttons.css";

const workIcons = { text: BookOpen, illustration: Palette, comic: PanelsTopLeft, music: Headphones, video: Film, cosplay: Drama, other: Orbit };

export function WorkTypeIcon({ type }: { type: WorkType | null }) {
  const Icon = workIcons[type ?? "other"];
  return <Icon size={14} strokeWidth={1.8} aria-hidden="true" />;
}

export function WorkTypeMark({ type }: { type: WorkType | null }) {
  return <span className="work-type"><WorkTypeIcon type={type} />{type ? workTypeLabels[type] : "作品"}</span>;
}

export function ObservationMark() {
  return <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className="observation-mark">
    <path d="M32 9a23 23 0 1 0 23 23" stroke="currentColor" strokeWidth="1" />
    <path d="M35 14l4 11 11 4-11 4-4 11-4-11-11-4 11-4Z" fill="currentColor" />
  </svg>;
}

export function WorkCover({ work, full = false }: { work: WorkData; full?: boolean }) {
  if (work.coverUrl) return <div className={`work-cover${full ? " work-cover--full" : ""}`}>
    <img src={work.coverUrl} alt={work.coverAlt || `${work.previewTitle ?? "作品"}封面`} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
  </div>;
  return <div className={`work-cover work-cover--typographic work-cover--${work.workType ?? "other"}`}>
    <div className="work-paper-top"><span>HIFUU / FIELD NOTES</span><ObservationMark /></div>
    <p className="work-paper-title">{work.previewTitle || "尚未填写标题"}</p>
    <p className="work-paper-excerpt">{work.previewSummary || "在故事交汇之处，继续观测。"}</p>
    <span className="work-paper-signature">{work.publicAuthorName || "尚未填写署名"}</span>
  </div>;
}

// Admin preview and public detail share only the public presentation contract.
export function WorkPresentation({ work }: { work: WorkData }) {
  return <div className="work-presentation">
    <header className="work-heading">
      <WorkTypeMark type={work.workType} />
      <h1>{work.previewTitle || "尚未填写标题"}</h1>
      <p className="work-byline">{work.publicAuthorName || "尚未填写署名"}{work.formatLabel && <span> / {work.formatLabel}</span>}</p>
    </header>
    {work.coverUrl && <WorkCover work={work} full />}
    <div className="work-reading">
      <span className="eyebrow">ABOUT THIS OBSERVATION</span>
      <p className="work-description">{work.previewSummary || "尚未填写简介"}</p>
      {work.publicTags.length > 0 && <ul className="work-tags" aria-label="作品标签">{work.publicTags.map(tag => <li key={tag}>{tag}</li>)}</ul>}
      {work.workUrl && <a className="button button--primary button--industrial" href={work.workUrl} target="_blank" rel="noopener noreferrer">查看原作品 <ArrowUpRight size={16} aria-hidden="true" /><span className="sr-only">（在新标签页打开）</span></a>}
    </div>
  </div>;
}
