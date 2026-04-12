import type { ParticipantPortalStatus } from "../../src/shared/portal";

export function resolveParticipantActionEligibility(
  participant: { status: ParticipantPortalStatus } | null,
) {
  if (!participant) {
    return {
      ok: false as const,
      code: "portal_pending_review",
      message: "当前账号已登录，但尚未获得参与资格。请先补充资料并等待主催审核。",
    };
  }

  if (participant.status === "withdrawn") {
    return {
      ok: false as const,
      code: "portal_participant_withdrawn",
      message: "你的参与资格已被撤回。如需恢复，请联系主催。",
    };
  }

  return {
    ok: true as const,
  };
}
