export const RELAY_START = "2026-11-12T00:00:00+08:00";
export function scheduleMissionStart(entries: readonly { scheduledAt: string | null; kind?: 'standard' | 'extra' }[]) {
  let start: number | null = null;
  for (const entry of entries) {
    if (!entry.scheduledAt || entry.kind === 'extra') continue;
    const time = Date.parse(entry.scheduledAt);
    if (Number.isFinite(time) && (start === null || time < start)) start = time;
  }
  return start;
}

/** Mission hours continue past midnight; Beijing time remains the publication clock. */
export function missionTime(value: string | number, start: number) {
  const elapsed = new Date(value).getTime() - start;
  const minutes = Math.floor(Math.abs(elapsed) / 60000);
  return `T${elapsed < 0 ? "−" : "+"}${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
