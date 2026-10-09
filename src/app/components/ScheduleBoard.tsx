import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { PublicScheduleEntry } from "../../shared/works";
import { WorkTypeMark } from "./WorkPresentation";
import { scheduleDay, scheduleHour, type ScheduleDay } from "../lib/schedule-layout";
import { missionTime } from "../lib/mission-time";
import "./schedule-board.css";

export const scheduleStatusLabels = {
  available: "待认领", reserved: "已预留", confirmed: "已确认", unavailable: "不可选择",
} satisfies Record<PublicScheduleEntry["status"], string>;
const timeFormat = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dateFormat = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "long", day: "numeric", weekday: "long" });

function MissionClock({ value, start }: { value: string | number; start: number | null }) {
  if (start === null) return <span>{timeFormat.format(new Date(value))}</span>;
  const label = missionTime(value, start);
  return <span className="ops-mission-time"><span className="ops-mission-prefix">{label.slice(0, 2)}</span>{label.slice(2)}</span>;
}

function dayInstant(day: ScheduleDay, hour: number) {
  return Date.parse(`${day.key}T00:00:00+08:00`) + hour * 3600000;
}

export function scheduleAuthor(entry: PublicScheduleEntry, ownName?: string | null) {
  return entry.publicAuthorName || ownName || (entry.status === "available" ? "待认领"
    : entry.status === "reserved" ? "署名待确认" : entry.status === "confirmed" ? "署名待补充" : "暂不可选");
}

export function ScheduleStatus({ status }: { status: PublicScheduleEntry["status"] }) {
  return <span className="ops-status"><i className={`ops-mark ops-mark--${status}`} aria-hidden="true" />{scheduleStatusLabels[status]}</span>;
}

function ScheduleRuler({ day, missionStart, selected, currentId, mineId, now, active }: {
  day: ScheduleDay; missionStart: number; selected?: PublicScheduleEntry; currentId: string | null; mineId: string | null; now: number; active: boolean;
}) {
  const showNow = active && scheduleDay(now) === day.key;
  return <div className="ops-overview">
    <div className="ops-ruler" aria-label={`${missionTime(dayInstant(day, 0), missionStart)} 到 ${missionTime(dayInstant(day, 24), missionStart)}，UTC+8 全天标尺`}>
      <div className="ops-scale" aria-hidden="true">
        {Array.from({ length: 97 }, (_, index) => {
          const hour = index / 4;
          return <span key={index} className={`ops-tick${index % 24 === 0 ? " is-major" : index % 4 === 0 ? " is-medium" : ""}`} style={{ left: `${hour / 24 * 100}%` }}>
            {index % 8 === 0 && <span className={index % 24 === 0 ? "is-mobile-major" : ""}>{missionTime(dayInstant(day, hour), missionStart)}</span>}
          </span>;
        })}
      </div>
      <div className="ops-occupancy" aria-hidden="true">
        {day.entries.map(entry => <i key={entry.id} className={`ops-window ops-window--${entry.status}${entry.id === selected?.id ? " is-selected" : ""}${entry.id === mineId ? " is-mine" : ""}${entry.id === currentId ? " is-current" : ""}`}
          style={{ left: `${scheduleHour(entry.scheduledAt!) / 24 * 100}%`, width: `${Math.min(1, 24 - scheduleHour(entry.scheduledAt!)) / 24 * 100}%` }} />)}
      </div>
      {selected?.scheduledAt && <div className={`ops-cursor ops-cursor--selected${scheduleHour(selected.scheduledAt) > 21 ? " is-near-end" : ""}`} aria-hidden="true" style={{ left: `${scheduleHour(selected.scheduledAt) / 24 * 100}%` }}>
        <span>{missionTime(selected.scheduledAt, missionStart)} 已选</span>
      </div>}
      {showNow && <div className={`ops-cursor ops-cursor--now${scheduleHour(now) > 21 ? " is-near-end" : ""}`} aria-hidden="true" style={{ left: `${scheduleHour(now) / 24 * 100}%` }}><span>当前 {missionTime(now, missionStart)}</span></div>}
    </div>
  </div>;
}

/** Subdivide each actual interval; unconfigured slots never receive invented clock ticks. */
function ScheduleIntervalTicks({ day, missionStart, start, end }: { day: ScheduleDay; missionStart: number; start: number; end: number }) {
  const first = Math.floor(start * 6) + 1;
  const last = Math.ceil(end * 6);
  return <span className="ops-interval" aria-hidden="true">
    {Array.from({ length: Math.max(0, last - first) }, (_, index) => {
      const step = first + index;
      const hour = step / 6;
      return <i key={step} className={`ops-interval-tick${step % 6 === 0 ? " is-hour" : step % 3 === 0 ? " is-half" : ""}`} style={{ top: `${(hour - start) / (end - start) * 100}%` }}>
        {step % 6 === 0 && <span>{missionTime(dayInstant(day, hour), missionStart)}</span>}
      </i>;
    })}
  </span>;
}

export function ScheduleBoard({ day, missionStart, selectedId, mineId, ownName, currentId, now, active, onSelect }: {
  day: ScheduleDay; missionStart: number | null; selectedId: string | null; mineId: string | null; ownName: string | null; currentId: string | null;
  now: number; active: boolean; onSelect: (id: string) => void;
}) {
  const selected = day.entries.find(entry => entry.id === selectedId);
  return <section className="ops-day" id={`relay-day-${day.key}`} aria-labelledby={`ops-day-${day.key}`}>
    <div className="ops-day-heading"><h2 className="ops-day-title" id={`ops-day-${day.key}`}>{day.key === 'extra' ? '追加坑位' : day.date ? <time dateTime={day.date}>{dateFormat.format(new Date(day.date))}</time> : "发布时间待定"}</h2></div>
    {day.date ? <ScheduleRuler day={day} missionStart={missionStart!} selected={selected} currentId={currentId} mineId={mineId} now={now} active={active} />
      : <p className="ops-unconfigured">{day.key === 'extra' ? '追加坑位独立于标准排程。' : '发布时刻尚未配置，以下按接力顺序排列。'}</p>}
    <div className={`ops-board${day.date ? "" : " ops-board--pending"}`}>
      {day.shifts.map((shift, index) => <section className="ops-shift" key={shift.start ?? index} aria-labelledby={`ops-shift-${day.key}-${index}`}>
        <header className="ops-shift-heading">
          <h3 id={`ops-shift-${day.key}-${index}`}>{shift.start !== null ? <><span className="ops-shift-mission"><MissionClock start={missionStart} value={dayInstant(day, shift.start)} /><span>—</span><MissionClock start={missionStart} value={dayInstant(day, shift.start + 6)} /></span></> : day.key === 'extra' ? <><small>追加</small>{shift.entries[0]?.code.replace('EXTRA-', '')}<span>—</span>{shift.entries.at(-1)?.code.replace('EXTRA-', '')}</> : <><small>第</small>{shift.entries[0]?.code}<span>—</span>{shift.entries.at(-1)?.code}<small>棒</small></>}</h3>
          <span>{shift.entries.filter(entry => entry.status === "confirmed" || entry.status === "reserved").length} / {shift.entries.length} 已排入</span>
        </header>
        {shift.entries.length > 0 ? <>
          <ol className={`ops-rack${shift.start === null ? " ops-rack--pending" : ""}`}>
            {shift.start !== null && scheduleHour(shift.entries[0]!.scheduledAt!) > shift.start && <li className="ops-timeline-gap" aria-hidden="true" style={{ minHeight: `${(scheduleHour(shift.entries[0]!.scheduledAt!) - shift.start) * 84}px` }}>
              <ScheduleIntervalTicks day={day} missionStart={missionStart!} start={shift.start} end={scheduleHour(shift.entries[0]!.scheduledAt!)} />
            </li>}
            {shift.entries.map((entry, entryIndex) => {
              const mine = entry.id === mineId;
              const inspected = entry.id === selectedId;
              const author = scheduleAuthor(entry, mine ? ownName : null);
              const start = entry.scheduledAt ? scheduleHour(entry.scheduledAt) : null;
              const next = shift.entries[entryIndex + 1];
              const end = start !== null ? next?.scheduledAt ? scheduleHour(next.scheduledAt) : shift.start! + 6 : null;
              return <li key={entry.id} id={`relay-${entry.id}`} style={start !== null && end !== null ? { minHeight: `${Math.max(84, (end - start) * 84)}px` } : undefined}>
                {start !== null && end !== null && <ScheduleIntervalTicks day={day} missionStart={missionStart!} start={start} end={end} />}
                <button type="button" className={`ops-task ops-task--${entry.status}${mine ? " is-mine" : ""}${inspected ? " is-selected" : ""}${entry.id === currentId ? " is-current" : ""}`}
                  aria-pressed={inspected} aria-controls={`ops-detail-${day.key}`} onClick={() => onSelect(entry.id)}
                  aria-label={`${entry.kind === 'extra' ? entry.name : entry.scheduledAt ? `${missionTime(entry.scheduledAt, missionStart!)}，${timeFormat.format(new Date(entry.scheduledAt))} UTC+8` : `第 ${entry.code} 棒，时间待定`}，${author}，${scheduleStatusLabels[entry.status]}${mine ? "，我的时段" : ""}`}>
                  <span className="ops-task-clock">{entry.scheduledAt ? <><time dateTime={entry.scheduledAt}><MissionClock start={missionStart} value={entry.scheduledAt} /></time></> : <><strong>{entry.code}</strong><small>{entry.kind === 'extra' ? '追加坑位' : '时间待定'}</small></>}</span>
                  <span className={`ops-task-anchor ops-task-anchor--${entry.status}`} aria-hidden="true" />
                  <span className="ops-task-copy"><span className="ops-task-author">{author}{mine && <span className="ops-mine-label">我的</span>}{entry.id === currentId && <span className="ops-current-label">当前接力</span>}</span>
                    {entry.preview?.previewTitle ? <span className="ops-task-work">{entry.preview.previewTitle}</span> : <span className="ops-task-work">{entry.status === "available" ? "选择此时点报名" : scheduleStatusLabels[entry.status]}</span>}
                  </span>
                </button>
              </li>;
            })}
          </ol>
          <div className="ops-shift-foot"><span>{shift.start !== null ? `${missionTime(dayInstant(day, shift.start + 6), missionStart!)} 止` : `${shift.entries.length} 个${day.key === 'extra' ? '追加坑位' : '发布时刻'}`}</span><span>{shift.entries.filter(entry => entry.status === "available").length} 个空位</span></div>
        </> : <p className="ops-shift-empty">此时段尚未配置发布时刻</p>}
      </section>)}
    </div>
  </section>;
}

export function ScheduleTaskDetail({ entry, missionStart, mine, ownName, signedIn, ended, detailId, onClose, actions }: {
  entry: PublicScheduleEntry; missionStart: number | null; mine: boolean; ownName: string | null; signedIn: boolean; ended: boolean; detailId: string; onClose?: () => void;
  actions?: ReactNode;
}) {
  return <section className="ops-detail" id={detailId} aria-label="选中时段详情">
    <div className="ops-detail-time"><span>{entry.kind === 'extra' ? '选中追加坑位' : '选中时段'}</span><strong>{entry.scheduledAt ? <MissionClock start={missionStart} value={entry.scheduledAt} /> : entry.code}</strong><span>{entry.kind === 'extra' ? entry.name : `第 ${entry.code} 棒`}{mine ? " / 我的时段" : ""}</span></div>
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
      {entry.workId ? <Link to="/works/$workId" params={{ workId: entry.workId }}>查看作品 ↗</Link> : null}
      {actions !== undefined ? actions : entry.status === "available" || mine ? <Link to={signedIn ? "/portal" : "/portal/login"} search={{ segment: mine ? "" : entry.id }} hash={signedIn ? "plan" : undefined}>{mine ? "管理我的时段" : "选择这个时点并报名"}</Link> : null}
      {entry.status !== "available" && <p>{entry.workId ? "作品已公开。" : ended ? "作品尚未公开。" : "作者确认发布且资料审核通过后，作品详情会在这里开放。"}</p>}
    </div>
  </section>;
}
