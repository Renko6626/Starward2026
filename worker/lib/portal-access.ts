import type { ParticipantPortalStatus } from "../../src/shared/portal";

export function resolveParticipantActionEligibility(
  participant: { status: ParticipantPortalStatus } | null,
) {
  if (!participant) {
    return {
      ok: false as const,
      code: "portal_creator_missing",
      message: "当前账号尚未完成创作者工作台初始化，请重新登录或联系主催。",
    };
  }

  if (participant.status === "pending") {
    return {
      ok: false as const,
      code: "portal_pending_review",
      message: "当前账号已进入创作者工作台，但参与资格仍在审核中，暂时不能操作时间段或其他已放行动作。",
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

export function resolveProjectWorkspaceEligibility(
  participant: { status: ParticipantPortalStatus } | null,
) {
  if (!participant) {
    return {
      ok: false as const,
      code: "portal_creator_missing",
      message: "当前账号尚未完成创作者工作台初始化，请重新登录或联系主催。",
    };
  }

  if (participant.status === "pending") {
    return {
      ok: false as const,
      code: "portal_pending_review",
      message: "报名审核通过后可填写作品资料，请先查看报名进度。",
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
