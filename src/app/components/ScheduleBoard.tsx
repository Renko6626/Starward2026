import { useSiteTranslation } from "../../i18n/use-site-translation";
import { Link } from "@tanstack/react-router";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import type { PublicScheduleEntry } from "../../shared/works";
import { workTypeLabels } from "../../shared/works";
import { WorkTypeIcon, WorkTypeMark } from "./WorkPresentation";
import { scheduleDay, scheduleHour, type ScheduleDay } from "../lib/schedule-layout";
import { missionTime } from "../lib/mission-time";
import { Crossfade } from "./Crossfade";
import { ScheduleTrace } from "./ScheduleTrace";
import { localizeSystemLabel, localizeSegmentName, type SiteLanguage } from "../../shared/i18n";
import "./schedule-board.css";

export const scheduleStatusLabels = {
  available: "待认领", reserved: "已预留", confirmed: "已确认", unavailable: "不可选择",
} satisfies Record<PublicScheduleEntry["status"], string>;

function MissionClock({ value, start }: { value: string | number; start: number | null }) {
  const { language } = useSiteTranslation();
  const timeFormat = new Intl.DateTimeFormat(language, { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  if (start === null) return <span>{timeFormat.format(new Date(value))}</span>;
  const label = missionTime(value, start);
  return <span className="ops-mission-time"><span className="ops-mission-prefix">{label.slice(0, 2)}</span>{label.slice(2)}</span>;
}

function dayInstant(day: ScheduleDay, hour: number) {
  return Date.parse(`${day.key}T00:00:00+08:00`) + hour * 3600000;
}

export function scheduleAuthor(entry: PublicScheduleEntry, ownName?: string | null, language: SiteLanguage = "zh-CN") {
  return entry.publicAuthorName || ownName || localizeSystemLabel(entry.status === "available" ? "待认领"
    : entry.status === "reserved" ? "署名待确认" : entry.status === "confirmed" ? "署名待补充" : "暂不可选", language);
}

export function ScheduleStatus({ status }: { status: PublicScheduleEntry["status"] }) {
  const { label } = useSiteTranslation();
  return <span className="ops-status"><i className={`ops-mark ops-mark--${status}`} aria-hidden="true" />{label(scheduleStatusLabels[status])}</span>;
}

function scheduleWorkType(entry: PublicScheduleEntry) {
  return entry.preview?.workType ?? (entry.interestFormat === "novel" ? "text" : entry.interestFormat);
}

function ScheduleTask({ entry, missionStart, mine, inspected, current, ownName, onSelect }: {
  entry: PublicScheduleEntry; missionStart: number | null; mine: boolean; inspected: boolean; current: boolean;
  ownName: string | null; onSelect: (id: string) => void;
}) {
  const { t, language, label } = useSiteTranslation();
  const timeFormat = new Intl.DateTimeFormat(language, { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const author = scheduleAuthor(entry, mine ? ownName : null, language);
  const workType = scheduleWorkType(entry);
  const typeLabel = workType ? label(workTypeLabels[workType]) : t("public.schedule.typePending");
  const typeIcon = entry.status === "confirmed"
    ? <span className={`ops-task-type ops-work-type--${workType ?? "other"}`} title={typeLabel} aria-hidden="true"><WorkTypeIcon type={workType} /></span> : null;
  const previousStatus = useRef(entry.status);
  const fill = useAnimationControls();
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const changed = previousStatus.current !== entry.status;
    previousStatus.current = entry.status;
    fill.stop();
    fill.set({ clipPath: "inset(0 0% 0 0)" });
    // Polling and selection keep the same status: only real occupancy changes draw in.
    if (changed && !reducedMotion && (entry.status === "reserved" || entry.status === "confirmed")) {
      fill.set({ clipPath: "inset(0 100% 0 0)" });
      void fill.start({ clipPath: "inset(0 0% 0 0)", transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } });
    }
    return () => fill.stop();
  }, [entry.status, reducedMotion, fill]);

  return <button type="button" className={`ops-task ops-task--${entry.status}${mine ? " is-mine" : ""}${inspected ? " is-selected" : ""}${current ? " is-current" : ""}`}
    aria-pressed={inspected} aria-haspopup="dialog" aria-controls="ops-slot-dialog" onClick={() => onSelect(entry.id)}
    aria-label={[entry.kind === "extra" ? localizeSegmentName(entry.code, entry.name, language) : entry.scheduledAt ? `${missionTime(entry.scheduledAt, missionStart!)} / ${timeFormat.format(new Date(entry.scheduledAt))} UTC+8` : t("public.schedule.slotPending", { code: entry.code }), author, label(scheduleStatusLabels[entry.status]), entry.status === "confirmed" ? typeLabel : "", mine ? t("public.schedule.mine") : ""].filter(Boolean).join(language === "en" ? ", " : "，")}>
    <motion.span className="ops-task-fill" aria-hidden="true" initial={false} animate={fill} />
    <span className="ops-task-selection" aria-hidden="true" />
    <span className={`ops-task-clock${entry.scheduledAt ? " ops-task-clock--timed" : ""}`}>{entry.scheduledAt ? <><time dateTime={entry.scheduledAt}><MissionClock start={missionStart} value={entry.scheduledAt} /></time>{typeIcon}</>
      : <><strong>{entry.code}</strong><small>{entry.kind === 'extra' ? t("public.schedule.extra") : t("public.schedule.timePending")}{typeIcon}</small></>}
    </span>
    <span className={`ops-task-anchor ops-task-anchor--${entry.status}`} aria-hidden="true" />
    <span className="ops-task-copy">
      <span className="ops-task-heading">
        <span className="ops-task-author">{author}{mine && <span className="ops-mine-label">{t("public.schedule.my")}</span>}{current && <span className="ops-current-label">{t("public.schedule.current")}</span>}</span>
        {entry.status !== "available" && <span className="ops-task-state"><ScheduleStatus status={entry.status} /></span>}
      </span>
      {inspected && entry.status === "available" ? <span className="ops-task-work ops-task-quick-action"><span className="ops-quick-desktop">{t("public.schedule.clickAgain")}</span><span className="ops-quick-mobile">{t("public.schedule.clickSelect")}</span> <span aria-hidden="true">↗</span></span>
        : entry.preview?.previewTitle ? <span className="ops-task-work">{entry.preview.previewTitle}</span>
        : entry.status === "available" ? <span className="ops-task-work ops-task-action">{t("public.schedule.selectTime")} <span aria-hidden="true">↗</span></span> : null}
    </span>
  </button>;
}

function ScheduleRuler({ day, missionStart, selected, currentId, mineId, now, active }: {
  day: ScheduleDay; missionStart: number; selected?: PublicScheduleEntry; currentId: string | null; mineId: string | null; now: number; active: boolean;
}) {
  const { t } = useSiteTranslation();
  const reducedMotion = useReducedMotion();
  const showNow = active && scheduleDay(now) === day.key;
  return <div className="ops-overview">
    <div className="ops-ruler" aria-label={t("public.schedule.ruler", { start: missionTime(dayInstant(day, 0), missionStart), end: missionTime(dayInstant(day, 24), missionStart) })}>
      <div className="ops-scale" aria-hidden="true">
        <ScheduleTrace direction="horizontal" />
        {Array.from({ length: 25 }, (_, hour) => {
          return <span key={hour} className={`ops-tick${hour % 6 === 0 ? " is-major" : " is-medium"}`} style={{ left: `${hour / 24 * 100}%` }}>
            {hour % 6 === 0 && <span className="is-mobile-major">{missionTime(dayInstant(day, hour), missionStart)}</span>}
          </span>;
        })}
      </div>
      <div className="ops-occupancy" aria-hidden="true">
        {day.entries.map((entry, index) => {
          const start = scheduleHour(entry.scheduledAt!);
          const next = day.entries[index + 1];
          const end = next?.scheduledAt ? scheduleHour(next.scheduledAt) : 24;
          return <i key={entry.id} className={`ops-window ops-window--${entry.status} ops-work-type--${scheduleWorkType(entry) ?? "other"}${entry.id === selected?.id ? " is-selected" : ""}${entry.id === mineId ? " is-mine" : ""}${entry.id === currentId ? " is-current" : ""}`}
            style={{ left: `${start / 24 * 100}%`, width: `${Math.max(0, Math.min(1, end - start)) / 24 * 100}%` }} />;
        })}
      </div>
      {selected?.scheduledAt && <motion.div className={`ops-cursor ops-cursor--selected${scheduleHour(selected.scheduledAt) > 21 ? " is-near-end" : ""}`} aria-hidden="true"
        initial={false} animate={{ left: `${scheduleHour(selected.scheduledAt) / 24 * 100}%` }}
        transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}>
        <span>{t("public.schedule.selectedClock", { time: missionTime(selected.scheduledAt, missionStart) })}</span>
      </motion.div>}
      {showNow && <div className={`ops-cursor ops-cursor--now${scheduleHour(now) > 21 ? " is-near-end" : ""}`} aria-hidden="true" style={{ left: `${scheduleHour(now) / 24 * 100}%` }}><span>{t("public.schedule.currentClock", { time: missionTime(now, missionStart) })}</span></div>}
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
  const { t, language } = useSiteTranslation();
  const dateFormat = new Intl.DateTimeFormat(language, { timeZone: "Asia/Shanghai", month: "long", day: "numeric", weekday: "long" });
  const selected = day.entries.find(entry => entry.id === selectedId);
  return <section className="ops-day" id={`relay-day-${day.key}`} aria-labelledby={`ops-day-${day.key}`}>
    <div className="ops-day-heading"><h2 className="ops-day-title" id={`ops-day-${day.key}`}>{day.key === 'extra' ? t("public.schedule.extra") : day.date ? <time dateTime={day.date}>{dateFormat.format(new Date(day.date))}</time> : t("public.schedule.pending")}</h2></div>
    {day.date ? <ScheduleRuler day={day} missionStart={missionStart!} selected={selected} currentId={currentId} mineId={mineId} now={now} active={active} />
      : <p className="ops-unconfigured">{day.key === 'extra' ? t("public.schedule.extraIndependent") : t("public.schedule.noTimes")}</p>}
    <div className={`ops-board${day.date ? "" : " ops-board--pending"}`}>
      {day.shifts.map((shift, index) => <section className="ops-shift" key={shift.start ?? index} aria-labelledby={`ops-shift-${day.key}-${index}`}>
        <header className="ops-shift-heading">
          <h3 id={`ops-shift-${day.key}-${index}`}>{shift.start !== null ? <><span className="ops-shift-mission"><MissionClock start={missionStart} value={dayInstant(day, shift.start)} /><span>—</span><MissionClock start={missionStart} value={dayInstant(day, shift.start + 6)} /></span></> : day.key === 'extra' ? <><small>{t("public.schedule.extraShort")}</small>{shift.entries[0]?.code.replace('EXTRA-', '')}<span>—</span>{shift.entries.at(-1)?.code.replace('EXTRA-', '')}</> : <><small>{t("public.schedule.ordinal")}</small>{shift.entries[0]?.code}<span>—</span>{shift.entries.at(-1)?.code}<small>{t("public.schedule.leg")}</small></>}</h3>
          <span>{t("public.schedule.assigned", { count: shift.entries.filter(entry => entry.status === "confirmed" || entry.status === "reserved").length, total: shift.entries.length })}</span>
        </header>
        {shift.entries.length > 0 ? <>
          <div className="ops-rack-frame">
            {shift.start !== null && <ScheduleTrace direction="vertical" delay={170 + index * 55} />}
            <ol className={`ops-rack${shift.start === null ? " ops-rack--pending" : ""}`}>
              {shift.start !== null && scheduleHour(shift.entries[0]!.scheduledAt!) > shift.start && <li className="ops-timeline-gap" aria-hidden="true" style={{ minHeight: `${(scheduleHour(shift.entries[0]!.scheduledAt!) - shift.start) * 84}px` }}>
                <ScheduleIntervalTicks day={day} missionStart={missionStart!} start={shift.start} end={scheduleHour(shift.entries[0]!.scheduledAt!)} />
              </li>}
              {shift.entries.map((entry, entryIndex) => {
                const mine = entry.id === mineId;
                const inspected = entry.id === selectedId;
                const start = entry.scheduledAt ? scheduleHour(entry.scheduledAt) : null;
                const next = shift.entries[entryIndex + 1];
                const end = start !== null ? next?.scheduledAt ? scheduleHour(next.scheduledAt) : shift.start! + 6 : null;
                return <li key={entry.id} id={`relay-${entry.id}`} className={`ops-work-type--${scheduleWorkType(entry) ?? "other"}`} style={start !== null && end !== null ? { minHeight: `${Math.max(84, (end - start) * 84)}px` } : undefined}>
                  {start !== null && end !== null && <ScheduleIntervalTicks day={day} missionStart={missionStart!} start={start} end={end} />}
                  {(entry.status === "reserved" || entry.status === "confirmed") && <span className={`ops-timeline-strip ops-timeline-strip--${entry.status}`} aria-hidden="true" />}
                  <ScheduleTask entry={entry} missionStart={missionStart} mine={mine} inspected={inspected} current={entry.id === currentId}
                    ownName={ownName} onSelect={onSelect} />
                </li>;
              })}
            </ol>
          </div>
          <div className="ops-shift-foot"><span>{shift.start !== null ? t("public.schedule.shiftEnd", { time: missionTime(dayInstant(day, shift.start + 6), missionStart!) }) : t("public.schedule.slotCount", { count: shift.entries.length, kind: day.key === "extra" ? t("public.schedule.extra") : t("public.schedule.releaseSlots") })}</span><span>{t("public.schedule.availableCount", { count: shift.entries.filter(entry => entry.status === "available").length })}</span></div>
        </> : <p className="ops-shift-empty">{t("public.schedule.noShiftTimes")}</p>}
      </section>)}
    </div>
  </section>;
}

export function ScheduleTaskDetail({ entry, missionStart, mine, ownName, signedIn, ended, detailId, onClose, actions }: {
  entry: PublicScheduleEntry; missionStart: number | null; mine: boolean; ownName: string | null; signedIn: boolean; ended: boolean; detailId: string; onClose?: () => void;
  actions?: ReactNode;
}) {
  const { t, language } = useSiteTranslation();
  const workType = scheduleWorkType(entry);
  return <section className="ops-detail" id={detailId} aria-label={t("public.schedule.selectedDetails")}>
    <Crossfade valueKey={entry.id}><div className="ops-detail-time"><span>{entry.kind === 'extra' ? t("public.schedule.selectedExtra") : t("public.schedule.selected")}</span><strong>{entry.scheduledAt ? <MissionClock start={missionStart} value={entry.scheduledAt} /> : entry.code}</strong><span>{entry.kind === "extra" ? localizeSegmentName(entry.code, entry.name, language) : t("public.schedule.slot", { code: entry.code })}{mine ? ` / ${t("public.schedule.mine")}` : ""}</span></div>
    </Crossfade>
    <Crossfade valueKey={entry.id}><div className="ops-detail-copy">
      <div className="ops-detail-heading"><h2>{scheduleAuthor(entry, mine ? ownName : null, language)}</h2><ScheduleStatus status={entry.status} />{onClose && <button type="button" className="ops-close" onClick={onClose}>{t("public.schedule.close")}</button>}</div>
      {entry.status === "confirmed" ? <>
        <div className="ops-detail-work">{workType && <WorkTypeMark type={workType} />}<h3>{t("public.schedule.plan")}</h3></div>
        <p className="ops-detail-description">{entry.introText?.trim() || t("public.schedule.noPlan")}</p>
      </> : <p className="ops-detail-description">{entry.status === "available" ? t("public.schedule.availableNote")
        : entry.status === "reserved" ? t("public.schedule.reservedNote") : t("public.schedule.unavailableNote")}</p>}
      {entry.preview?.coverUrl && <img className="ops-detail-cover" src={entry.preview.coverUrl} alt={entry.preview.coverAlt || t("public.work.previewAlt", { title: entry.preview.previewTitle ?? t("public.work.generic") })} loading="lazy" decoding="async" referrerPolicy="no-referrer" />}
    </div>
    </Crossfade>
    <div className="ops-detail-actions">
      {entry.workId ? <Link to="/works/$workId" params={{ workId: entry.workId }}>{t("public.schedule.viewWork")}</Link> : null}
      {actions !== undefined ? actions : entry.status === "available" || mine ? <Link to={signedIn ? "/portal" : "/portal/login"} search={{ segment: mine ? "" : entry.id }} hash={signedIn ? "plan" : undefined}>{mine ? t("public.schedule.manageTime") : t("public.schedule.selectRegister")}</Link> : null}
      {entry.status !== "available" && <p>{entry.workId ? t("public.schedule.workPublic") : ended ? t("public.schedule.workHidden") : t("public.schedule.workPublicNote")}</p>}
    </div>
  </section>;
}
