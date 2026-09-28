import { HTTPException } from "hono/http-exception";
import { Resend } from "resend";
import { resolveApplicationDisplayName } from "../../src/shared/application-identity";
import type {
  ApplicationDetail,
  ApplicationStatus,
  AdminApplicationReviewNotification,
} from "../../src/shared/applications";
import { recordParticipantInviteSent } from "../data/admin";
import { isParticipantPortalEligible } from "../data/participants";
import type { AppBindings } from "./types";

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
      "使用当前邮箱和密码登录；尚未设置密码的账号可先通过邮箱验证码登录。",
      "登录后可以继续维护作品资料，并在开放窗口内处理时间段等正式动作。",
      "如果邮箱已变更或资格状态需要调整，请直接联系主催。",
    ].join("\n"),
  };
}

function getRequiredParticipantInviteMailEnv(env: AppBindings) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw new HTTPException(503, {
      message: "Resend mail sender is not configured yet.",
    });
  }

  return {
    resendApiKey: env.RESEND_API_KEY,
    resendFromEmail: env.RESEND_FROM_EMAIL,
    resendFromName: env.RESEND_FROM_NAME?.trim() || "Starward2026",
  };
}

export async function sendParticipantPortalInviteEmail(
  env: AppBindings,
  payload: {
    displayName: string;
    email: string;
    portalLoginUrl: string;
  },
) {
  const { resendApiKey, resendFromEmail, resendFromName } = getRequiredParticipantInviteMailEnv(env);
  const resend = new Resend(resendApiKey);
  const message = buildParticipantPortalInviteEmail({
    displayName: payload.displayName,
    portalLoginUrl: payload.portalLoginUrl,
  });
  const response = await resend.emails.send({
    from: `${resendFromName} <${resendFromEmail}>`,
    to: payload.email,
    subject: message.subject,
    text: message.text,
  });

  if (response.error) {
    throw new Error(response.error.message || "Failed to send participant portal invite email.");
  }
}

export async function maybeSendParticipantApprovalNotice(input: {
  env: AppBindings;
  db: D1Database;
  actorId: string;
  requestUrl: string;
  previousStatus: ApplicationStatus;
  application: ApplicationDetail;
  sendParticipantPortalInviteEmail?: typeof sendParticipantPortalInviteEmail;
  recordParticipantInviteSent?: typeof recordParticipantInviteSent;
}): Promise<AdminApplicationReviewNotification | null> {
  if (input.application.status !== "approved" || input.previousStatus === "approved") {
    return null;
  }

  const participant = input.application.participant;

  if (!participant || !isParticipantPortalEligible(participant.status)) {
    return {
      status: "failed",
      message: "已更新为已通过，但确认邮件发送失败：未找到可发送提醒的参与者记录。",
    };
  }

  const portalLoginUrl = new URL("/portal/login", input.requestUrl).toString();
  const displayName = resolveApplicationDisplayName({
    displayName: input.application.displayName,
    contactHandle: input.application.contactHandle,
    contactEmail: input.application.contactEmail,
  });
  const sendInvite = input.sendParticipantPortalInviteEmail ?? sendParticipantPortalInviteEmail;
  const recordInvite = input.recordParticipantInviteSent ?? recordParticipantInviteSent;

  try {
    await sendInvite(input.env, {
      displayName,
      email: participant.inviteEmail,
      portalLoginUrl,
    });
    await recordInvite(input.db, {
      participantId: participant.id,
      actorId: input.actorId,
      portalLoginUrl,
    });

    return {
      status: "sent",
      message: `已更新为已通过，并已向 ${participant.inviteEmail} 发送确认邮件。`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";

    return {
      status: "failed",
      message: `已更新为已通过，但确认邮件发送失败：${message}`,
    };
  }
}
