import { describe, expect, it } from "vitest";
import { adminParticipantStatusLabels, adminParticipantStatusValues } from "./admin";
import { participantPortalStatusLabels } from "./portal";

describe("participant status model", () => {
  it("uses pending plus approval status as the canonical creator lifecycle model", () => {
    expect(adminParticipantStatusValues).toEqual(["pending", "approved", "withdrawn", "completed"]);
    expect(adminParticipantStatusLabels).toEqual({
      pending: "待审核",
      approved: "已批准",
      withdrawn: "已撤回",
      completed: "已完成",
    });
  });

  it("shows creator qualification labels independently from portal activation", () => {
    expect(participantPortalStatusLabels).toEqual({
      pending: "待审核",
      approved: "已获得参与资格",
      withdrawn: "已撤回",
      completed: "已完成",
    });
  });
});
