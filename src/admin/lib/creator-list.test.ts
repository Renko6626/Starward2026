import { describe, expect, it } from "vitest";
import { buildCreatorRows, filterCreatorRows, summarizeSchedule } from "./creator-list";
import type { AdminParticipantItem } from "../../shared/admin";
import type { ApplicationListItem } from "../../shared/applications";

const participant: AdminParticipantItem = {
  id: "part_1", applicationId: "app_1", displayName: "莲子", inviteEmail: "renko@example.com",
  contactHandle: "QQ: 123", isAnonymous: false, status: "pending", currentSegmentCode: "S01", updatedAt: "2026-10-09",
};
const application: ApplicationListItem = {
  id: "app_1", participantId: "part_1", displayName: "莲子", contactEmail: "renko@example.com",
  contactHandle: "QQ: 123", interestFormat: "novel", status: "pending", createdAt: "2026-10-09",
  reviewedAt: null, authUserEmail: "renko@example.com", hasPortalProfile: true, participantStatus: "pending",
};

describe("creator management", () => {
  it("merges linked records while retaining unsubmitted accounts and unlinked applications", () => {
    const rows = buildCreatorRows([participant, { ...participant, id: "part_2", applicationId: null }],
      [application, { ...application, id: "legacy", participantId: null }]);
    expect(rows.map(row => [row.participant?.id ?? null, row.application?.id ?? null])).toEqual([
      ["part_1", "app_1"], ["part_2", null], [null, "legacy"],
    ]);
    expect(filterCreatorRows(rows, "pending", "").map(row => row.application?.id)).toEqual(["app_1", "legacy"]);
    expect(filterCreatorRows(rows, "all", "s01")).toHaveLength(2);
  });

  it("does not infer approval or link different people from a shared email", () => {
    // The API can report participantId from its historical email fallback.
    const rows = buildCreatorRows([participant], [{ ...application, id: "app_other", participantId: "part_1", status: "rejected" }]);
    expect(rows).toHaveLength(2);
    expect(filterCreatorRows(rows, "pending", "")).toEqual([]);
  });

  it("counts released slots as available and excludes locked or occupied open slots", () => {
    expect(summarizeSchedule([
      { status: "open", currentParticipantId: null }, { status: "released", currentParticipantId: null },
      { status: "locked", currentParticipantId: null }, { status: "open", currentParticipantId: "part_1" },
      { status: "held", currentParticipantId: "part_2" }, { status: "completed", currentParticipantId: "part_3" },
    ])).toEqual({ total: 6, open: 2, held: 1, completed: 1 });
  });
});
