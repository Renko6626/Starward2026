import { describe, expect, it, vi } from "vitest";
import {
  buildWindowFlagMap,
  eventWindowLabels,
  getApplicationWindowLabel,
  type EventWindowSummary,
} from "../../src/shared/windows";
import { computeWindowState, mapEventWindowRow } from "./windows";

function buildWindow(
  key: EventWindowSummary["key"],
  overrides: Partial<EventWindowSummary> = {},
): EventWindowSummary {
  return {
    key,
    label: eventWindowLabels[key],
    isEnabled: false,
    isOpen: false,
    state: "disabled",
    opensAt: null,
    closesAt: null,
    updatedAt: "2026-04-11T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildWindowFlagMap", () => {
  it("reads canonical segment window keys", () => {
    const flags = buildWindowFlagMap([
      buildWindow("application_open", { isEnabled: true, isOpen: true, state: "open" }),
      buildWindow("segment_claim_open" as EventWindowSummary["key"], { isEnabled: true, isOpen: true, state: "open" }),
      buildWindow("segment_change_open" as EventWindowSummary["key"], { isOpen: false }),
      buildWindow("preview_submit_open", { isEnabled: true, isOpen: true, state: "open" }),
      buildWindow("review_submit_open", { isOpen: false }),
      buildWindow("public_release_open", { isOpen: false }),
    ]);

    expect(flags.applicationOpen).toBe(true);
    expect(flags.segmentClaimOpen).toBe(true);
    expect(flags.segmentChangeOpen).toBe(false);
  });
});


describe("window state and labels", () => {
  const start = "2026-04-01T00:00:00.000Z";
  const end = "2026-06-30T23:59:59.000Z";
  it("distinguishes disabled, scheduled, open and ended including exact boundaries", () => {
    expect(computeWindowState(false, start, end, Date.parse(start))).toBe("disabled");
    expect(computeWindowState(true, start, end, Date.parse(start) - 1)).toBe("scheduled");
    expect(computeWindowState(true, start, end, Date.parse(start))).toBe("open");
    expect(computeWindowState(true, start, end, Date.parse(end))).toBe("ended");
    expect(computeWindowState(true, start, end, Date.parse("2026-09-30T00:00:00Z"))).toBe("ended");
    expect(computeWindowState(true, null, null)).toBe("open");
  });
  it("uses the server state for public copy and keeps ended windows closed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T00:00:00Z"));
    const window = mapEventWindowRow({
      key: "application_open",
      label: "报名开放",
      is_enabled: 1,
      opens_at: start,
      closes_at: end,
      updated_at: start,
    });
    vi.useRealTimers();
    expect(window).toMatchObject({ state: "ended", isOpen: false });
    expect(getApplicationWindowLabel(window)).toBe("报名已结束");
    expect(getApplicationWindowLabel(buildWindow("application_open", { isEnabled: true, state: "scheduled" }))).toBe("报名尚未开始");
  });
});
