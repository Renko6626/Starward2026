import { Link } from "@tanstack/react-router";
import type { PublicScheduleEntry } from "../../shared/works";
import { WorkTypeMark } from "./WorkPresentation";
import { scheduleDay, scheduleHour, type ScheduleDay } from "../lib/schedule-layout";
import "./schedule-board.css";

export const scheduleStatusLabels = {
  available: "待认领", reserved: "已预留", confirmed: "已确认", unavailable: "不可选择",
} satisfies Record<PublicScheduleEntry["status"], string>;
const timeFormat = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dateFormat = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "long", day: "numeric", weekday: "long" });
const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

export function scheduleAuthor(entry: PublicScheduleEntry, ownName?: string | null) {
  return entry.publicAuthorName || ownName || (entry.status === "available" ? "待认领"
    : entry.status === "reserved" ? "署名待确认" : entry.status === "confirmed" ? "署名待补充" : "暂不可选");
}

export function ScheduleStatus({ status }: { status: PublicScheduleEntry["status"] }) {
  return <span className="ops-status"><i className={`ops-mark ops-mark--${status}`} aria-hidden="true" />{scheduleStatusLabels[status]}</span>;
}

function ScheduleRuler({ day, selected, currentId, mineId, now, active }: {
  day: ScheduleDay; selected?: PublicScheduleEntry; currentId: string | null; mineId: string | null; now: number; active: boolean;
}) {
  const showNow = active && scheduleDay(now) === day.key;
  return <div className="ops-overview">
    <div className="ops-overview-heading"><span>全天排程</span><span>{day.entries.length} 个发布时刻</span></div>
    <div className="ops-ruler" aria-label="北京时间 00:00 到 24:00 的全天标尺">
      <div className="ops-scale" aria-hidden="true">
        {Array.from({ length: 25 }, (_, hour) => <span key={hour} className={`ops-tick${hour % 6 === 0 ? " is-major" : hour % 2 === 0 ? " is-medium" : ""}`} style={{ left: `${hour / 24 * 100}%` }}>
          {hour % 2 === 0 && <span className={hour % 6 === 0 ? "is-mobile-major" : ""}>{hourLabel(hour)}</span>}
        </span>)}
      </div>
      <div className="ops-occupancy" aria-hidden="true">
        {day.entries.map(entry => <i key={entry.id} className={`ops-window ops-window--${entry.status}${entry.id === selected?.id ? " is-selected" : ""}${entry.id === mineId ? " is-mine" : ""}${entry.id === currentId ? " is-current" : ""}`}
          style={{ left: `${scheduleHour(entry.scheduledAt!) / 24 * 100}%`, width: `${Math.min(1, 24 - scheduleHour(entry.scheduledAt!)) / 24 * 100}%` }} />)}
      </div>
      {selected?.scheduledAt && <div className={`ops-cursor ops-cursor--selected${scheduleHour(selected.scheduledAt) > 21 ? " is-near-end" : ""}`} aria-hidden="true" style={{ left: `${scheduleHour(selected.scheduledAt) / 24 * 100}%` }}>
        <span>{timeFormat.format(new Date(selected.scheduledAt))} 已选</span>
      </div>}
      {showNow && <div className={`ops-cursor ops-cursor--now${scheduleHour(now) > 21 ? " is-near-end" : ""}`} aria-hidden="true" style={{ left: `${scheduleHour(now) / 24 * 100}%` }}><span>当前 {timeFormat.format(new Date(now))}</span></div>}
    </div>
  </div>;
}

export function ScheduleBoard({ day, selectedId, mineId, ownName, currentId, now, active, matches, onSelect }: {
  day: ScheduleDay; selectedId: string | null; mineId: string | null; ownName: string | null; currentId: string | null;
  now: number; active: boolean; matches: Set<string> | null; onSelect: (id: string) => void;
}) {
  const selected = day.entries.find(entry => entry.id === selectedId);
  return <section className="ops-day" id={`relay-day-${day.key}`} aria-labelledby={`ops-day-${day.key}`}>
    <h2 className="ops-day-title" id={`ops-day-${day.key}`}>{day.date ? <time dateTime={day.date}>{dateFormat.format(new Date(day.date))}</time> : "发布时间待定"}</h2>
    {day.date ? <ScheduleRuler day={day} selected={selected} currentId={currentId} mineId={mineId} now={now} active={active} />
      : <p className="ops-unconfigured">发布时刻尚未配置，以下按接力顺序排列。</p>}
    <div className={`ops-board${day.date ? "" : " ops-board--pending"}`}>
      {day.shifts.map((shift, index) => <section className="ops-shift" key={shift.start ?? index} aria-labelledby={`ops-shift-${day.key}-${index}`}>
        <header className="ops-shift-heading">
          <h3 id={`ops-shift-${day.key}-${index}`}>{shift.start !== null ? <>{String(shift.start).padStart(2, "0")}<span>—</span>{String(shift.start + 6).padStart(2, "0")}<small>时</small></> : <><small>第</small>{shift.entries[0]?.code}<span>—</span>{shift.entries.at(-1)?.code}<small>棒</small></>}</h3>
          <span>{shift.entries.filter(entry => entry.status === "confirmed" || entry.status === "reserved").length} / {shift.entries.length} 已排入</span>
        </header>
        {shift.entries.length > 0 ? <>
          <div className="ops-fields" aria-hidden="true"><span>{shift.start !== null ? "时刻" : "棒次"}</span><span>作者署名</span><span>状态</span></div>
          <ol className="ops-rack">
            {shift.entries.map(entry => {
              const mine = entry.id === mineId;
              const inspected = entry.id === selectedId;
              const author = scheduleAuthor(entry, mine ? ownName : null);
              return <li key={entry.id} id={`relay-${entry.id}`}>
                <button type="button" className={`ops-task ops-task--${entry.status}${mine ? " is-mine" : ""}${inspected ? " is-selected" : ""}${entry.id === currentId ? " is-current" : ""}${matches && !matches.has(entry.id) && !inspected ? " is-dimmed" : ""}`}
                  aria-pressed={inspected} aria-controls={`ops-detail-${day.key}`} onClick={() => onSelect(entry.id)}
                  aria-label={`${entry.scheduledAt ? timeFormat.format(new Date(entry.scheduledAt)) : `第 ${entry.code} 棒，时间待定`}，${author}，${scheduleStatusLabels[entry.status]}${mine ? "，我的时段" : ""}`}>
                  <span className="ops-task-clock">{entry.scheduledAt ? <time dateTime={entry.scheduledAt}>{timeFormat.format(new Date(entry.scheduledAt))}</time> : <><strong>{entry.code}</strong><small>时间待定</small></>}</span>
                  <span className="ops-task-author">{author}{mine && <span className="ops-mine-label">我的</span>}{entry.id === currentId && <span className="ops-current-label">当前接力</span>}</span>
                  <ScheduleStatus status={entry.status} />
                </button>
              </li>;
            })}
          </ol>
          <div className="ops-shift-foot"><span>{shift.start !== null ? `${hourLabel(shift.start)} 起` : `${shift.entries.length} 个发布时刻`}</span><span>{shift.entries.filter(entry => entry.status === "available").length} 个空位</span></div>
        </> : <p className="ops-shift-empty">此时段尚未配置发布时刻</p>}
      </section>)}
    </div>
  </section>;
}

export function ScheduleTaskDetail({ entry, mine, ownName, signedIn, ended, detailId, onClose }: {
  entry: PublicScheduleEntry; mine: boolean; ownName: string | null; signedIn: boolean; ended: boolean; detailId: string; onClose?: () => void;
}) {
  return <section className="ops-detail" id={detailId} aria-label="选中时段详情">
    <div className="ops-detail-time"><span>选中时段</span><strong>{entry.scheduledAt ? timeFormat.format(new Date(entry.scheduledAt)) : entry.code}</strong><span>第 {entry.code} 棒{mine ? " / 我的时段" : ""}</span></div>
    <div className="ops-detail-copy">
      <div className="ops-detail-heading"><h2>{scheduleAuthor(entry, mine ? ownName : null)}</h2><ScheduleStatus status={entry.status} />{onClose && <button type="button" className="ops-close" onClick={onClose}>关闭</button>}</div>
      {entry.preview ? <>
        <div className="ops-detail-work">{entry.preview.workType && <WorkTypeMark type={entry.preview.workType} />}<h3>{entry.preview.previewTitle}</h3></div>
        {entry.preview.previewSummary && <p className="ops-detail-description">{entry.preview.previewSummary}</p>}
      </> : <p className="ops-detail-description">{entry.status === "available" ? "在报名时选择这个发布时刻，提交后预留，审核通过后确认。"
        : entry.status === "reserved" ? "这个时段已被预留，正在等待报名审核。" : entry.status === "confirmed" ? "作者已确认，作品预告待公布。" : "这个时段暂不可认领。"}</p>}
      {entry.preview?.coverUrl && <img className="ops-detail-cover" src={entry.preview.coverUrl} alt={entry.preview.coverAlt || `${entry.preview.previewTitle ?? "作品"}预览`} loading="lazy" decoding="async" referrerPolicy="no-referrer" />}
    </div>
    <div className="ops-detail-actions">
      {entry.workId ? <Link to="/works/$workId" params={{ workId: entry.workId }}>查看作品 ↗</Link>
        : entry.status === "available" || mine ? <Link to={signedIn ? "/portal" : "/portal/login"} hash={signedIn ? "plan" : undefined}>{mine ? "管理我的时段" : "前往认领"}</Link> : null}
      {entry.status !== "available" && <p>{entry.workId ? "作品已公开。" : ended ? "作品尚未公开。" : "作品详情在接力结束后开放。"}</p>}
    </div>
  </section>;
}
