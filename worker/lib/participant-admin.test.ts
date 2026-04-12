import { describe, expect, it } from "vitest";

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
