export function buildParticipantPortalInviteEmail(input: {
  displayName: string;
  portalLoginUrl: string;
}) {
  const displayName = input.displayName.trim() || "参与者";

  return {
    subject: "Starward2026 参与资格通过提醒",
    text: [
      `${displayName}，你好。`,
      "",
      "你已经通过 Starward2026 本期参与资格审核。",
      "",
      `创作者工作台入口：${input.portalLoginUrl}`,
      "",
      "继续使用当前邮箱，即可收到一次性验证码完成登录。",
      "登录后可以继续维护作品资料，并在开放窗口内处理时间段等正式动作。",
      "如果邮箱已变更或资格状态需要调整，请直接联系主催。",
    ].join("\n"),
  };
}
