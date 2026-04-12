import { describe, expect, it } from "vitest";
import type { ApplicationDetail } from "../../shared/applications";

function createApplicationDetail(
  overrides: Partial<ApplicationDetail> = {},
): ApplicationDetail {
  return {
    id: "app_1",
    displayName: "示例报名",
    contactEmail: "sample@example.com",
    contactHandle: "@sample",
    interestFormat: "novel",
    status: "pending",
    createdAt: "2026-04-12T00:00:00.000Z",
    reviewedAt: null,
    authUserEmail: null,
    hasPortalProfile: false,
    participantId: null,
    participantStatus: null,
    introText: null,
    portfolioUrl: null,
    messageToHosts: null,
    adminNote: null,
    reviewedBy: null,
    updatedAt: "2026-04-12T00:00:00.000Z",
    authUser: null,
    portalProfile: null,
    participant: null,
    ...overrides,
  };
}

describe("summarizeApplicationReviewState", () => {
  it("flags unbound applications as incompatible with the current formal application rule", async () => {
    const { summarizeApplicationReviewState } = await import("./application-review");

    const summary = summarizeApplicationReviewState(createApplicationDetail());

    expect(summary.recommendation).toBe(
      "该记录尚未绑定参与者入口账号，不符合当前正式报名规则。建议先引导对方完成入口登录，再继续处理；如系历史数据，需人工核对。",
    );
    expect(summary.inviteAction).toEqual({
      enabled: false,
      label: "需先绑定入口账号",
      reason: "当前还没有参与者入口账号，不能直接发送正式门户提醒。",
    });
    expect(summary.items.map((item) => item.statusLabel)).toEqual([
      "未建立入口",
      "联系资料未补充",
      "待审核",
      "未转入参与者",
    ]);
  });

  it("marks auth and profile as ready when the applicant has already entered the portal", async () => {
    const { summarizeApplicationReviewState } = await import("./application-review");

    const summary = summarizeApplicationReviewState(
      createApplicationDetail({
        authUserEmail: "portal@example.com",
        hasPortalProfile: true,
        authUser: {
          id: "user_1",
          email: "portal@example.com",
        },
        portalProfile: {
          penName: "八云",
          contactEmail: "portal@example.com",
          primaryContactChannel: "Discord",
          primaryContactHandle: "@yakumo",
          backupContact: null,
          publicCreditMode: "named",
          publicCreditName: null,
        },
      }),
    );

    expect(summary.recommendation).toBe("入口账号和联系资料已具备，可直接完成审核并转入参与者。");
    expect(summary.items.map((item) => item.completed)).toEqual([true, true, false, false]);
  });

  it("recommends sending a first portal reminder after the participant record is created", async () => {
    const { summarizeApplicationReviewState } = await import("./application-review");

    const summary = summarizeApplicationReviewState(
      createApplicationDetail({
        status: "approved",
        participantId: "part_1",
        participantStatus: "invited",
        participant: {
          id: "part_1",
          inviteEmail: "sample@example.com",
          status: "invited",
          activatedAt: null,
        },
      }),
    );

    expect(summary.recommendation).toBe(
      "该报名已转入参与者，建议直接发送门户提醒邮件，引导对方首次登录激活。",
    );
    expect(summary.inviteAction).toEqual({
      enabled: true,
      label: "发送门户提醒邮件",
      reason: "参与者记录已创建，但对方还没有完成首次登录激活。",
    });
  });

  it("switches to resend wording after the participant has already activated the portal", async () => {
    const { summarizeApplicationReviewState } = await import("./application-review");

    const summary = summarizeApplicationReviewState(
      createApplicationDetail({
        status: "approved",
        participantId: "part_2",
        participantStatus: "active",
        participant: {
          id: "part_2",
          inviteEmail: "sample@example.com",
          status: "active",
          activatedAt: "2026-04-12T08:00:00.000Z",
        },
      }),
    );

    expect(summary.recommendation).toBe("该报名已进入参与者流程。后续维护建议转到参与者详情页继续处理。");
    expect(summary.inviteAction).toEqual({
      enabled: true,
      label: "补发门户提醒邮件",
      reason: "该参与者已激活门户，如需提醒可补发入口邮件。",
    });
  });
});
