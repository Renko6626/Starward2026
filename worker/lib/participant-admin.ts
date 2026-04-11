import type { ParticipantPortalStatus } from "../../src/shared/portal";

export function resolveParticipantStatusForAdminUpdate(input: {
  requestedStatus: ParticipantPortalStatus;
  hasActivatedPortal: boolean;
}): ParticipantPortalStatus {
  if (input.requestedStatus === "invited" && input.hasActivatedPortal) {
    return "active";
  }

  return input.requestedStatus;
}

export function buildParticipantPortalInviteEmail(input: {
  displayName: string;
  portalLoginUrl: string;
}) {
  const displayName = input.displayName.trim() || "参与者";

  return {
    subject: "Starward2026 参与者门户入口提醒",
    text: [
      `${displayName}，你好。`,
      "",
      "你已经进入 Starward2026 的参与者名单，可以开始使用参与者门户。",
      "",
      `登录入口：${input.portalLoginUrl}`,
      "",
      "进入后输入当前受邀邮箱，即可收到一次性验证码完成登录。",
      "如果邮箱已变更或资格状态需要调整，请直接联系主催。",
    ].join("\n"),
  };
}
