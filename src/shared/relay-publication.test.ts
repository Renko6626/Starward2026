import { describe, expect, it } from "vitest";
import { getRelayPublicationState } from "./relay-publication";

const scheduledAt = "2026-11-12T15:00:00.000Z"; // 23:00 Beijing
const state = (now: string, confirmedAt: string | null = null) =>
  getRelayPublicationState(scheduledAt, confirmedAt, new Date(now));

describe("relay publication timing", () => {
  it("starts reminding exactly seven days before the scheduled instant", () => {
    expect(state("2026-11-05T14:59:59.999Z").showReminder).toBe(false);
    expect(state("2026-11-05T15:00:00.000Z")).toMatchObject({ showReminder: true, canConfirm: false });
  });
  it("permits the whole Beijing publication day, before and after the scheduled hour", () => {
    expect(state("2026-11-11T15:59:59.999Z").canConfirm).toBe(false);
    expect(state("2026-11-11T16:00:00.000Z")).toMatchObject({ phase: "today", canConfirm: true });
    expect(state("2026-11-12T15:59:59.999Z").canConfirm).toBe(true);
    expect(state("2026-11-12T16:00:00.000Z")).toMatchObject({ phase: "overdue", canConfirm: false });
  });
  it("keeps confirmed links editable after the day and without a current scheduled time", () => {
    expect(state("2026-11-20T00:00:00Z", "2026-11-12T15:00:00Z"))
      .toMatchObject({ phase: "confirmed", canEditLink: true, showReminder: false });
    expect(getRelayPublicationState(null, "2026-11-12T15:00:00Z", new Date()))
      .toMatchObject({ phase: "confirmed", canEditLink: true });
    expect(getRelayPublicationState(null, null, new Date()))
      .toMatchObject({ phase: "unconfigured", canConfirm: false, canEditLink: false });
  });
});
