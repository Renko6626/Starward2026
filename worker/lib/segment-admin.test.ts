import { describe, expect, it } from "vitest";

describe("resolveAdminSegmentState", () => {
  it("rejects held status without a participant assignment", async () => {
    const module = await import("./segment-admin").catch(() => null);

    expect(module).not.toBeNull();

    if (!module) {
      return;
    }

    expect(() =>
      module.resolveAdminSegmentState({
        currentStatus: "open",
        currentParticipantId: null,
        currentClaimedAt: null,
        nextStatus: "held",
        nextParticipantId: null,
        now: "2026-04-11T12:00:00.000Z",
      }),
    ).toThrow(/认领人/);
  });

  it("retains participant assignment when locked", async () => {
    const { resolveAdminSegmentState } = await import("./segment-admin");

    expect(
      resolveAdminSegmentState({
        currentStatus: "held",
        currentParticipantId: "part_01",
        currentClaimedAt: "2026-04-10T12:00:00.000Z",
        nextStatus: "locked",
        nextParticipantId: "part_01",
        now: "2026-04-11T12:00:00.000Z",
      }),
    ).toMatchObject({
      nextStatus: "locked",
      nextParticipantId: "part_01",
      claimedAt: "2026-04-10T12:00:00.000Z",
      releasedAt: null,
    });
  });

  it("refreshes claimedAt when the admin assigns a different participant into held status", async () => {
    const { resolveAdminSegmentState } = await import("./segment-admin");

    expect(
      resolveAdminSegmentState({
        currentStatus: "held",
        currentParticipantId: "part_old",
        currentClaimedAt: "2026-04-10T12:00:00.000Z",
        nextStatus: "held",
        nextParticipantId: "part_new",
        now: "2026-04-11T12:00:00.000Z",
      }),
    ).toMatchObject({
      nextStatus: "held",
      nextParticipantId: "part_new",
      claimedAt: "2026-04-11T12:00:00.000Z",
      releasedAt: null,
    });
  });
});
