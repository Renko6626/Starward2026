import { describe, expect, it } from "vitest";
import { buildWindowFlagMap, eventWindowLabels, type EventWindowSummary } from "../../src/shared/windows";

function buildWindow(
  key: EventWindowSummary["key"],
  overrides: Partial<EventWindowSummary> = {},
): EventWindowSummary {
  return {
    key,
    label: eventWindowLabels[key],
    isEnabled: false,
    isOpen: false,
    opensAt: null,
    closesAt: null,
    updatedAt: "2026-04-11T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildWindowFlagMap", () => {
  it("reads canonical segment window keys", () => {
    const flags = buildWindowFlagMap([
      buildWindow("application_open", { isOpen: true }),
      buildWindow("segment_claim_open" as EventWindowSummary["key"], { isOpen: true }),
      buildWindow("segment_change_open" as EventWindowSummary["key"], { isOpen: false }),
      buildWindow("preview_submit_open", { isOpen: true }),
      buildWindow("review_submit_open", { isOpen: false }),
      buildWindow("public_release_open", { isOpen: false }),
    ]);

    expect(flags.applicationOpen).toBe(true);
    expect(flags.segmentClaimOpen).toBe(true);
    expect(flags.segmentChangeOpen).toBe(false);
  });
});
