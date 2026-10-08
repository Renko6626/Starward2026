import { describe, expect, it } from "vitest";
import type { PublicScheduleEntry } from "../../shared/works";
import { groupSchedule, scheduleHour, schedulePhase } from "./schedule-layout";

const slot = (id: string, scheduledAt: string | null): PublicScheduleEntry => ({
  id, code: id, name: id, scheduledAt, status: "available", publicAuthorName: null, preview: null, workId: null,
});

describe("schedule layout", () => {
  it("orders actual instants and assigns dates and six-hour groups in Beijing time", () => {
    const days = groupSchedule([
      slot("evening", "2026-10-17T10:00:00Z"),
      slot("previous-day", "2026-10-16T15:00:00Z"),
      slot("morning", "2026-10-16T22:30:00Z"),
      slot("midnight", "2026-10-16T16:00:00Z"),
    ]);
    expect(days.map(day => day.key)).toEqual(["2026-10-16", "2026-10-17"]);
    expect(days[1]!.shifts.map(shift => shift.entries.map(entry => entry.id)))
      .toEqual([["midnight"], ["morning"], [], ["evening"]]);
    expect(scheduleHour("2026-10-16T22:30:00Z")).toBe(6.5);
  });

  it("keeps unconfigured slots separate without fabricating publication times", () => {
    const entries = [slot("unknown", null), slot("known", "2026-10-16T16:00:00Z")];
    const days = groupSchedule(entries);
    expect(days.map(day => day.key)).toEqual(["2026-10-17", "pending"]);
    expect(days[1]).toMatchObject({ date: null, shifts: [{ start: null, entries: [entries[0]] }] });
    expect(entries[0]!.scheduledAt).toBeNull();
    expect(schedulePhase(entries, Date.parse("2026-10-18T00:00:00Z"))).toEqual({ phase: "active", currentId: "known" });
  });

  it("does not activate the current task before launch and ends at the final release instant", () => {
    const entries = [slot("later", "2026-10-17T01:00:00Z"), slot("first", "2026-10-17T00:00:00Z")];
    expect(schedulePhase(entries, Date.parse("2026-10-16T23:59:59Z"))).toEqual({ phase: "before", currentId: null });
    expect(schedulePhase(entries, Date.parse("2026-10-17T00:30:00Z"))).toEqual({ phase: "active", currentId: "first" });
    expect(schedulePhase(entries, Date.parse("2026-10-17T01:00:00Z"))).toEqual({ phase: "ended", currentId: null });
  });
});
