import { describe, expect, it } from "vitest";

describe("resolveParticipantStatusForAdminUpdate", () => {
  it("keeps invited status for participants who have not activated the portal yet", async () => {
    const module = await import("./participant-admin").catch(() => null);

    expect(module).not.toBeNull();

    if (!module) {
      return;
    }

    expect(
      module.resolveParticipantStatusForAdminUpdate({
        requestedStatus: "invited",
        hasActivatedPortal: false,
      }),
    ).toBe("invited");
  });

  it("upgrades invited back to active when the participant has already activated the portal", async () => {
    const { resolveParticipantStatusForAdminUpdate } = await import("./participant-admin");

    expect(
      resolveParticipantStatusForAdminUpdate({
        requestedStatus: "invited",
        hasActivatedPortal: true,
      }),
    ).toBe("active");
  });
});

describe("buildParticipantPortalInviteEmail", () => {
  it("builds invite copy that points the participant to the portal login entry", async () => {
    const module = await import("./participant-admin").catch(() => null);

    expect(module).not.toBeNull();

    if (!module) {
      return;
    }

    const message = module.buildParticipantPortalInviteEmail({
      displayName: "莲子",
      portalLoginUrl: "https://starward2026.example.com/portal/login",
    });

    expect(message.subject).toContain("参与者门户");
    expect(message.text).toContain("莲子");
    expect(message.text).toContain("https://starward2026.example.com/portal/login");
    expect(message.text).toContain("验证码");
  });
});
