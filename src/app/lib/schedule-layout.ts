import type { PublicScheduleEntry } from "../../shared/works";

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
});
const clockFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

export function scheduleDay(value: string | number) {
  return dayFormat.format(new Date(value));
}

export function scheduleHour(value: string | number) {
  const [hour = 0, minute = 0, second = 0] = clockFormat.format(new Date(value)).split(":").map(Number);
  return hour + minute / 60 + second / 3600;
}

export type ScheduleDay = {
  key: string;
  date: string | null;
  entries: PublicScheduleEntry[];
  shifts: { start: number | null; entries: PublicScheduleEntry[] }[];
};

/** Keep unconfigured instants separate; never turn a slot number into a clock time. */
export function groupSchedule(entries: PublicScheduleEntry[]): ScheduleDay[] {
  const days = new Map<string, ScheduleDay>();
  const ordered = [...entries].sort((a, b) => {
    if (!a.scheduledAt) return b.scheduledAt ? 1 : 0;
    if (!b.scheduledAt) return -1;
    return Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt);
  });
  for (const entry of ordered) {
    const key = entry.scheduledAt ? scheduleDay(entry.scheduledAt) : "pending";
    let day = days.get(key);
    if (!day) {
      day = { key, date: entry.scheduledAt, entries: [], shifts: entry.scheduledAt
        ? [0, 6, 12, 18].map(start => ({ start, entries: [] })) : [] };
      days.set(key, day);
    }
    day.entries.push(entry);
    if (entry.scheduledAt) {
      day.shifts[Math.floor(scheduleHour(entry.scheduledAt) / 6)]!.entries.push(entry);
    } else {
      if (day.entries.length % 6 === 1) day.shifts.push({ start: null, entries: [] });
      day.shifts.at(-1)!.entries.push(entry);
    }
  }
  return [...days.values()];
}

/** Matches the existing public-release rule: details open at the final configured instant. */
export function schedulePhase(entries: PublicScheduleEntry[], now: number) {
  const timed = entries.filter(entry => entry.scheduledAt).sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!));
  const started = timed.some(entry => Date.parse(entry.scheduledAt!) <= now);
  const ended = timed.length > 0 && timed.length === entries.length && timed.every(entry => Date.parse(entry.scheduledAt!) <= now);
  return {
    phase: ended ? "ended" as const : started ? "active" as const : "before" as const,
    currentId: started && !ended ? timed.findLast(entry => Date.parse(entry.scheduledAt!) <= now)?.id ?? null : null,
  };
}
