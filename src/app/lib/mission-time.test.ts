import { describe, expect, it } from "vitest";
import { missionTime, scheduleMissionStart } from "./mission-time";

describe("relay mission time", () => {
  it("starts at the earliest configured release in the actual schedule", () => {
    const start = scheduleMissionStart([
      { scheduledAt: "2026-10-30T03:00:00+08:00" },
      { scheduledAt: null },
      { scheduledAt: "2026-10-30T00:00:00+08:00" },
    ]);
    expect(start).toBe(Date.parse("2026-10-30T00:00:00+08:00"));
    expect(missionTime("2026-10-30T00:00:00+08:00", start!)).toBe("T+00:00");
    expect(missionTime("2026-10-30T03:00:00+08:00", start!)).toBe("T+03:00");
    expect(missionTime("2026-10-31T06:30:00+08:00", start!)).toBe("T+30:30");
  });

  it("does not invent an epoch for unconfigured releases", () => {
    expect(scheduleMissionStart([])).toBeNull();
    expect(scheduleMissionStart([{ scheduledAt: null }])).toBeNull();
  });

  it("shows time before a supplied epoch and accepts clock timestamps", () => {
    const start = Date.parse("2026-10-30T00:00:00+08:00");
    expect(missionTime("2026-10-29T23:59:00+08:00", start)).toBe("T−00:01");
    expect(missionTime(Date.parse("2026-10-30T06:30:00+08:00"), start)).toBe("T+06:30");
  });
});
