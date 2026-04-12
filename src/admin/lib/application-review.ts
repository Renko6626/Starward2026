import type { ApplicationDetail } from "../../shared/applications";

type ReviewItemTone = "info" | "warn" | "success";

export type ApplicationReviewItem = {
  key: "entry" | "profile" | "review" | "participant";
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
            ? "已建立入口账号，但尚未补充联系资料；按当前规则，正式报名前应先完成这一步。"
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
        key: "participant",
        title: "参与者转入",
        statusLabel: hasParticipant ? "已转入参与者" : "未转入参与者",
        hint: hasParticipant
          ? `${application.participant!.id} / ${application.participant!.status}`
          : "批准后会创建或更新参与者记录。",
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
    if (!input.participant.activatedAt) {
      return "该报名已转入参与者，建议直接发送门户提醒邮件，引导对方首次登录激活。";
    }

    return "该报名已进入参与者流程。后续维护建议转到参与者详情页继续处理。";
  }

  if (input.hasAuthUser && input.hasProfile) {
    return "入口账号和联系资料已具备，可直接完成审核并转入参与者。";
  }

  if (input.hasAuthUser) {
    return "已建立入口账号，但联系资料未完成。按当前规则，应先补齐资料后再继续审核；如系历史数据，可人工例外处理。";
  }

  return "该记录尚未绑定参与者入口账号，不符合当前正式报名规则。建议先引导对方完成入口登录，再继续处理；如系历史数据，需人工核对。";
}

function resolveInviteAction(application: ApplicationDetail): ApplicationInviteAction {
  if (!application.participant) {
    return {
      enabled: false,
      label: "需先绑定入口账号",
      reason: "当前还没有参与者入口账号，不能直接发送正式门户提醒。",
    };
  }

  if (application.participant.status === "withdrawn") {
    return {
      enabled: false,
      label: "当前状态不可发送",
      reason: "已撤回的参与者不应继续发送门户提醒。",
    };
  }

  if (application.participant.activatedAt) {
    return {
      enabled: true,
      label: "补发门户提醒邮件",
      reason: "该参与者已激活门户，如需提醒可补发入口邮件。",
    };
  }

  return {
    enabled: true,
    label: "发送门户提醒邮件",
    reason: "参与者记录已创建，但对方还没有完成首次登录激活。",
  };
}
