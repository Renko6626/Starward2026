import { describe, expect, it } from "vitest";

describe("resolveParticipantActionEligibility", () => {
  it("treats a missing creator workspace record as a data initialization problem", async () => {
    const { resolveParticipantActionEligibility } = await import("./portal-access");

    expect(resolveParticipantActionEligibility(null)).toEqual({
      ok: false,
      code: "portal_creator_missing",
      message: "当前账号尚未完成创作者工作台初始化，请重新登录或联系主催。",
    });
  });

  it("blocks participant-only actions while the creator is still pending approval", async () => {
    const { resolveParticipantActionEligibility } = await import("./portal-access");

    expect(resolveParticipantActionEligibility({ status: "pending" })).toEqual({
      ok: false,
      code: "portal_pending_review",
      message: "当前账号已进入创作者工作台，但参与资格仍在审核中，暂时不能操作时间段或其他已放行动作。",
    });
  });

  it("allows approved participants to continue into participant actions", async () => {
    const { resolveParticipantActionEligibility } = await import("./portal-access");

    expect(resolveParticipantActionEligibility({ status: "approved" })).toEqual({
      ok: true,
    });
  });

  it("allows completed participants to continue into participant actions", async () => {
    const { resolveParticipantActionEligibility } = await import("./portal-access");

    expect(resolveParticipantActionEligibility({ status: "completed" })).toEqual({
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

describe("resolveProjectWorkspaceEligibility", () => {
  it("allows pending creators to continue into the project workspace", async () => {
    const { resolveProjectWorkspaceEligibility } = await import("./portal-access");

    expect(resolveProjectWorkspaceEligibility({ status: "pending" })).toEqual({
      ok: true,
    });
  });

  it("blocks withdrawn creators from the project workspace", async () => {
    const { resolveProjectWorkspaceEligibility } = await import("./portal-access");

    expect(resolveProjectWorkspaceEligibility({ status: "withdrawn" })).toEqual({
      ok: false,
      code: "portal_participant_withdrawn",
      message: "你的参与资格已被撤回。如需恢复，请联系主催。",
    });
  });
});
