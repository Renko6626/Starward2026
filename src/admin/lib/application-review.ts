import type { ApplicationDetail, ApplicationStatus } from "../../shared/applications";

type ReviewItemTone = "info" | "warn" | "success";

export type ApplicationReviewItem = {
  key: "entry" | "profile" | "review" | "workspace";
  title: string;
  statusLabel: string;
  hint: string;
  completed: boolean;
  tone: ReviewItemTone;
};

export type ApplicationInviteAction = {
  enabled: boolean;
  label: string;
  reason: string;
};

export type ApplicationReviewSummary = {
  items: ApplicationReviewItem[];
  recommendation: string;
  inviteAction: ApplicationInviteAction;
};

export function summarizeApplicationReviewState(
  application: ApplicationDetail,
): ApplicationReviewSummary {
  const hasAuthUser = Boolean(application.authUser);
  const hasProfile = Boolean(application.portalProfile);
  const hasParticipant = Boolean(application.participant);

  return {
    items: [
      {
        key: "entry",
        title: "入口账号",
        statusLabel: hasAuthUser ? "已建立入口" : "未建立入口",
        hint: hasAuthUser
          ? application.authUser!.email
          : "对方尚未通过 /portal/login 建立入口会话。",
        completed: hasAuthUser,
        tone: hasAuthUser ? "success" : "warn",
      },
      {
        key: "profile",
        title: "联系资料",
        statusLabel: hasProfile ? "联系资料已补充" : "联系资料未补充",
        hint: hasProfile
          ? `${application.portalProfile!.primaryContactChannel} / ${application.portalProfile!.primaryContactHandle}`
          : hasAuthUser
            ? "已建立入口账号，但尚未补充联系资料；建议先补齐资料，再继续资格判断。"
            : "该记录未绑定入口账号。除历史导入或异常数据外，不应再出现此类正式报名。",
        completed: hasProfile,
        tone: hasProfile ? "success" : "warn",
      },
      {
        key: "review",
        title: "审核决定",
        statusLabel: resolveReviewStatusLabel(application.status),
        hint: resolveReviewHint(application.status),
        completed: application.status !== "pending",
        tone: application.status === "approved" ? "success" : application.status === "pending" ? "warn" : "info",
      },
      {
        key: "workspace",
        title: "作者页面",
        statusLabel: hasParticipant ? "已建立作者页面" : "未建立作者页面",
        hint: hasParticipant
          ? `${application.participant!.id} / ${application.participant!.status} / ${application.participant!.activatedAt ? "门户已激活" : "门户未激活"}`
          : "首次验证码登录后会自动创建作者页面记录。",
        completed: hasParticipant,
        tone: hasParticipant ? "success" : "info",
      },
    ],
    recommendation: resolveRecommendation({
      hasAuthUser,
      hasProfile,
      participant: application.participant,
    }),
    inviteAction: resolveInviteAction(application),
  };
}

export function listAvailableApplicationReviewStatuses(currentStatus: ApplicationStatus) {
  return (["approved", "rejected", "withdrawn"] as const).filter((status) => status !== currentStatus);
}

function resolveReviewStatusLabel(status: ApplicationDetail["status"]) {
  if (status === "approved") {
    return "已批准";
  }

  if (status === "rejected") {
    return "已拒绝";
  }

  if (status === "withdrawn") {
    return "已撤回";
  }

  return "待审核";
}

function resolveReviewHint(status: ApplicationDetail["status"]) {
  if (status === "approved") {
    return "该报名已通过审核。";
  }

  if (status === "rejected") {
    return "该报名已被拒绝，可结合备注保留决策依据。";
  }

  if (status === "withdrawn") {
    return "该报名已被标记为撤回。";
  }

  return "当前仍处于待审核队列。";
}

function resolveRecommendation(input: {
  hasAuthUser: boolean;
  hasProfile: boolean;
  participant: ApplicationDetail["participant"];
}) {
  if (input.participant) {
    if (input.participant.status === "withdrawn") {
      return "该创作者资格已撤回。建议仅保留记录，不再继续推进本期动作。";
    }

    if (input.participant.status === "approved" || input.participant.status === "completed") {
      if (!input.participant.activatedAt) {
        return "该创作者资格已批准，建议发送通过提醒邮件，说明后续已解锁正式动作。";
      }

      return "该创作者已进入正式流程。后续维护建议转到创作者详情页继续处理。";
    }

    if (input.hasAuthUser && input.hasProfile) {
      return "入口账号、联系资料与作者页面已具备，可继续观察作品准备情况，并在合适时点开放参与资格。";
    }

    if (input.hasAuthUser) {
      return "创作者已进入作者页面，但联系资料未完成。建议先补齐资料，再决定是否开放参与资格。";
    }

    return "作者页面记录已存在，但未读取到入口账号信息，需人工核对。";
  }

  if (input.hasAuthUser && input.hasProfile) {
    return "入口账号和联系资料已具备。首次登录后会自动建立作者页面，可在确认作品准备情况后开放参与资格。";
  }

  if (input.hasAuthUser) {
    return "已建立入口账号，但联系资料未完成。建议先补齐资料，再继续审核；如系历史数据，可人工例外处理。";
  }

  return "该记录尚未绑定作者页面账号，不符合当前正式报名规则。建议先引导对方完成入口登录，再继续处理；如系历史数据，需人工核对。";
}

function resolveInviteAction(application: ApplicationDetail): ApplicationInviteAction {
  if (!application.participant) {
    return {
      enabled: false,
      label: "需先建立作者页面",
      reason: "当前还没有可发送提醒的作者页面记录。",
    };
  }

  if (application.participant.status === "withdrawn") {
    return {
      enabled: false,
      label: "当前状态不可发送",
      reason: "已撤回的创作者不应继续发送通过提醒。",
    };
  }

  if (application.participant.status !== "approved" && application.participant.status !== "completed") {
    return {
      enabled: false,
      label: "尚未开放资格",
      reason: "只有已批准的创作者才需要发送通过提醒。",
    };
  }

  if (application.participant.activatedAt) {
    return {
      enabled: true,
      label: "补发通过提醒邮件",
      reason: "该创作者已进入过作者页面，如需再次提醒可补发。",
    };
  }

  return {
    enabled: true,
    label: "发送通过提醒邮件",
    reason: "创作者资格已批准，可发送提醒说明后续已解锁的正式动作。",
  };
}
