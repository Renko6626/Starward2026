import { describe, expect, it, vi } from "vitest";
import type { ApplicationDetail } from "../../src/shared/applications";

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
    authUserEmail: "sample@example.com",
    hasPortalProfile: true,
    introText: null,
    portfolioUrl: null,
    messageToHosts: null,
    adminNote: null,
    reviewedBy: null,
    updatedAt: "2026-04-12T00:00:00.000Z",
    authUser: {
      id: "user_1",
      email: "sample@example.com",
    },
    portalProfile: {
      penName: "莲子",
      contactEmail: "sample@example.com",
      primaryContactChannel: "Discord",
      primaryContactHandle: "@renko",
      backupContact: null,
      publicCreditMode: "named",
      publicCreditName: null,
    },
    participantId: "part_1",
    participantStatus: "approved",
    participant: {
      id: "part_1",
      inviteEmail: "sample@example.com",
      status: "approved",
      activatedAt: null,
    },
    ...overrides,
  };
}

describe("buildParticipantPortalInviteEmail", () => {
  it("builds approval copy that points the participant to the portal login entry", async () => {
    const module = await import("./participant-admin").catch(() => null);

    expect(module).not.toBeNull();

    if (!module) {
      return;
    }

    const message = module.buildParticipantPortalInviteEmail({
      displayName: "莲子",
      portalLoginUrl: "https://starward2026.example.com/portal/login",
    });

    expect(message.subject).toContain("参与资格");
    expect(message.text).toContain("莲子");
    expect(message.text).toContain("https://starward2026.example.com/portal/login");
    expect(message.text).toContain("验证码");
  });
});

describe("maybeSendParticipantApprovalNotice", () => {
  it("sends the approval notice when an application first becomes approved", async () => {
    const module = await import("./participant-admin").catch(() => null);

    expect(module).not.toBeNull();

    if (!module) {
      return;
    }

    const sendParticipantPortalInviteEmail = vi.fn().mockResolvedValue(undefined);
    const recordParticipantInviteSent = vi.fn().mockResolvedValue(undefined);

    const notification = await module.maybeSendParticipantApprovalNotice({
      env: {},
      db: {} as D1Database,
      actorId: "admin@example.com",
      requestUrl: "https://hifuu-staging.ayafeed.com/api/admin/applications/app_1",
      previousStatus: "pending",
      application: createApplicationDetail({
        status: "approved",
      }),
      sendParticipantPortalInviteEmail,
      recordParticipantInviteSent,
    });

    expect(notification).toEqual({
      status: "sent",
      message: "已更新为已通过，并已向 sample@example.com 发送确认邮件。",
    });
    expect(sendParticipantPortalInviteEmail).toHaveBeenCalledWith(
      {},
      {
        displayName: "示例报名",
        email: "sample@example.com",
        portalLoginUrl: "https://hifuu-staging.ayafeed.com/portal/login",
      },
    );
    expect(recordParticipantInviteSent).toHaveBeenCalledWith(
      {},
      {
        participantId: "part_1",
        actorId: "admin@example.com",
        portalLoginUrl: "https://hifuu-staging.ayafeed.com/portal/login",
      },
    );
  });

  it("does not send another approval notice when the application was already approved", async () => {
    const module = await import("./participant-admin").catch(() => null);

    expect(module).not.toBeNull();

    if (!module) {
      return;
    }

    const sendParticipantPortalInviteEmail = vi.fn().mockResolvedValue(undefined);
    const recordParticipantInviteSent = vi.fn().mockResolvedValue(undefined);

    const notification = await module.maybeSendParticipantApprovalNotice({
      env: {},
      db: {} as D1Database,
      actorId: "admin@example.com",
      requestUrl: "https://hifuu-staging.ayafeed.com/api/admin/applications/app_1",
      previousStatus: "approved",
      application: createApplicationDetail({
        status: "approved",
      }),
      sendParticipantPortalInviteEmail,
      recordParticipantInviteSent,
    });

    expect(notification).toBeNull();
    expect(sendParticipantPortalInviteEmail).not.toHaveBeenCalled();
    expect(recordParticipantInviteSent).not.toHaveBeenCalled();
  });

  it("returns a clear failure notification when the approval email could not be sent", async () => {
    const module = await import("./participant-admin").catch(() => null);

    expect(module).not.toBeNull();

    if (!module) {
      return;
    }

    const sendParticipantPortalInviteEmail = vi.fn().mockRejectedValue(new Error("mail down"));
    const recordParticipantInviteSent = vi.fn().mockResolvedValue(undefined);

    const notification = await module.maybeSendParticipantApprovalNotice({
      env: {},
      db: {} as D1Database,
      actorId: "admin@example.com",
      requestUrl: "https://hifuu-staging.ayafeed.com/api/admin/applications/app_1",
      previousStatus: "pending",
      application: createApplicationDetail({
        status: "approved",
      }),
      sendParticipantPortalInviteEmail,
      recordParticipantInviteSent,
    });

    expect(notification).toEqual({
      status: "failed",
      message: "已更新为已通过，但确认邮件发送失败：mail down",
    });
    expect(recordParticipantInviteSent).not.toHaveBeenCalled();
  });
});
