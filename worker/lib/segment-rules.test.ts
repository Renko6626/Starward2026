import { describe, expect, it } from "vitest";
import type { EventWindowSummary } from "../../src/shared/windows";
import type { PortalSegmentSummary } from "../../src/shared/portal";
import { buildPortalSegmentActions } from "./segment-rules";

const baseWindow: EventWindowSummary = {
  key: "application_open",
  label: "报名开放",
  isEnabled: false,
  isOpen: false,
  opensAt: null,
  closesAt: null,
  updatedAt: "2026-04-11T00:00:00.000Z",
};

function buildWindows(
  overrides: Partial<Record<EventWindowSummary["key"], Partial<EventWindowSummary>>>,
): EventWindowSummary[] {
  const keys: EventWindowSummary["key"][] = [
    "application_open",
    "segment_claim_open",
    "segment_change_open",
    "preview_submit_open",
    "review_submit_open",
    "public_release_open",
  ];

  return keys.map((key) => ({
    ...baseWindow,
    key,
    label: key,
    ...(overrides[key] ?? {}),
  })) as EventWindowSummary[];
}

function buildSegment(overrides: Partial<PortalSegmentSummary> = {}): PortalSegmentSummary {
  return {
    id: "segment_03",
    code: "03",
    name: "第三时段",
    description: "第三时段说明",
    status: "held",
    claimedAt: "2026-04-11T00:00:00.000Z",
    releasedAt: null,
    sortOrder: 3,
    ...overrides,
  };
}

describe("buildPortalSegmentActions", () => {
  it("allows initial claim when participant has no current segment and claim window is open", () => {
    const actions = buildPortalSegmentActions({
      currentSegment: null,
      windows: buildWindows({
        segment_claim_open: {
          isEnabled: true,
          isOpen: true,
        },
      }),
    });

    expect(actions.canClaim).toBe(true);
    expect(actions.canChange).toBe(false);
    expect(actions.canRelease).toBe(false);
    expect(actions.claimHint).toContain("可以认领");
  });

  it("blocks claim when the claim window is closed", () => {
    const actions = buildPortalSegmentActions({
      currentSegment: null,
      windows: buildWindows({}),
    });

    expect(actions.canClaim).toBe(false);
    expect(actions.claimHint).toContain("未开放时间段认领");
  });

  it("allows change and release when participant already holds a segment and change window is open", () => {
    const actions = buildPortalSegmentActions({
      currentSegment: buildSegment(),
      windows: buildWindows({
        segment_change_open: {
          isEnabled: true,
          isOpen: true,
        },
      }),
    });

    expect(actions.canClaim).toBe(false);
    expect(actions.canChange).toBe(true);
    expect(actions.canRelease).toBe(true);
    expect(actions.claimHint).toContain("已经持有");
  });

  it("blocks change and release when participant already holds a segment but change window is closed", () => {
    const actions = buildPortalSegmentActions({
      currentSegment: buildSegment(),
      windows: buildWindows({}),
    });

    expect(actions.canChange).toBe(false);
    expect(actions.canRelease).toBe(false);
    expect(actions.changeHint).toContain("未开放");
    expect(actions.releaseHint).toContain("未开放");
  });
});
