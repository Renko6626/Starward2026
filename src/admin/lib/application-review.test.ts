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
    const { summarizeApplicationReviewState } =
      await import("./application-review");

    const summary = summarizeApplicationReviewState(createApplicationDetail());

    expect(summary.recommendation).toBe(
      "该记录尚未绑定作者页面账号，不符合当前正式报名规则。建议先引导对方完成入口登录，再继续处理；如系历史数据，需人工核对。",
    );
    expect(summary.inviteAction).toEqual({ enabled: false, label: "邮件提醒已停用", reason: "审核结果可在作者页面查看。" });
    expect(summary.items.map((item) => item.statusLabel)).toEqual([
      "未建立入口",
      "联系资料未补充",
      "待审核",
      "未建立作者页面",
    ]);
  });

  it("marks auth and profile as ready when the applicant has already entered the portal", async () => {
    const { summarizeApplicationReviewState } =
      await import("./application-review");

    const summary = summarizeApplicationReviewState(
      createApplicationDetail({
        authUserEmail: "portal@example.com",
        hasPortalProfile: true,
        authUser: {
          id: "user_1",
          email: "portal@example.com",
        },
        portalProfile: {
          creditName: "八云",
          contactEmail: "portal@example.com",
          primaryContactChannel: "Discord",
          primaryContactHandle: "@yakumo",
          backupContact: null,
          isAnonymous: false,
        },
      }),
    );

    expect(summary.recommendation).toBe(
      "入口账号和联系资料已具备。首次登录后会自动建立作者页面，可在确认作品准备情况后开放参与资格。",
    );
    expect(summary.items.map((item) => item.completed)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it("reports the open workspace without an email action", async () => {
    const { summarizeApplicationReviewState } =
      await import("./application-review");

    const summary = summarizeApplicationReviewState(
      createApplicationDetail({
        status: "approved",
        participantId: "part_1",
        participantStatus: "approved",
        participant: {
          id: "part_1",
          inviteEmail: "sample@example.com",
          status: "approved",
          activatedAt: null,
        },
      }),
    );

    expect(summary.recommendation).toBe(
      "该创作者资格已批准，作者页面已开放正式操作。",
    );
    expect(summary.inviteAction).toEqual({ enabled: false, label: "邮件提醒已停用", reason: "审核结果可在作者页面查看。" });
  });

  it("keeps email reminders disabled after workspace activation", async () => {
    const { summarizeApplicationReviewState } =
      await import("./application-review");

    const summary = summarizeApplicationReviewState(
      createApplicationDetail({
        status: "approved",
        participantId: "part_2",
        participantStatus: "approved",
        participant: {
          id: "part_2",
          inviteEmail: "sample@example.com",
          status: "approved",
          activatedAt: "2026-04-12T08:00:00.000Z",
        },
      }),
    );

    expect(summary.recommendation).toBe(
      "该创作者已进入正式流程。后续维护建议转到创作者详情页继续处理。",
    );
    expect(summary.inviteAction).toEqual({ enabled: false, label: "邮件提醒已停用", reason: "审核结果可在作者页面查看。" });
  });
});

describe("listAvailableApplicationReviewStatuses", () => {
  it("omits the current status from the admin review action list", async () => {
    const { listAvailableApplicationReviewStatuses } =
      await import("./application-review");

    expect(listAvailableApplicationReviewStatuses("pending")).toEqual([
      "approved",
      "rejected",
      "withdrawn",
    ]);
    expect(listAvailableApplicationReviewStatuses("approved")).toEqual([
      "rejected",
      "withdrawn",
    ]);
    expect(listAvailableApplicationReviewStatuses("rejected")).toEqual([
      "approved",
      "withdrawn",
    ]);
  });
});
