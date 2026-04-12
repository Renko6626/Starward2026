import { describe, expect, it } from "vitest";

describe("resolveParticipantActionEligibility", () => {
  it("blocks participant-only actions when the logged-in account is still pending review", async () => {
    const { resolveParticipantActionEligibility } = await import("./portal-access");

    expect(resolveParticipantActionEligibility(null)).toEqual({
      ok: false,
      code: "portal_pending_review",
      message: "当前账号已登录，但尚未获得参与资格。请先补充资料并等待主催审核。",
    });
  });

  it("allows invited participants to continue into participant actions", async () => {
    const { resolveParticipantActionEligibility } = await import("./portal-access");

    expect(resolveParticipantActionEligibility({ status: "invited" })).toEqual({
      ok: true,
    });
  });

  it("blocks withdrawn participants from participant actions", async () => {
    const { resolveParticipantActionEligibility } = await import("./portal-access");

    expect(resolveParticipantActionEligibility({ status: "withdrawn" })).toEqual({
      ok: false,
      code: "portal_participant_withdrawn",
      message: "你的参与资格已被撤回。如需恢复，请联系主催。",
    });
  });
});
