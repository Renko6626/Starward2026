import { describe, expect, it } from "vitest";

describe("resolvePortalApplicationMutation", () => {
  it("allows creating an application when the account has not submitted one yet", async () => {
    const { resolvePortalApplicationMutation } = await import("./portal-application");

    expect(resolvePortalApplicationMutation(null, true)).toEqual({
      mode: "create",
      editable: true,
    });
  });

  it("allows editing a pending application", async () => {
    const { resolvePortalApplicationMutation } = await import("./portal-application");

    expect(resolvePortalApplicationMutation("pending", true)).toEqual({
      mode: "update",
      editable: true,
    });
  });

  it("blocks creating an application while the application window is closed", async () => {
    const { resolvePortalApplicationMutation } = await import("./portal-application");

    expect(resolvePortalApplicationMutation(null, false)).toEqual({
      mode: "create",
      editable: false,
      reason: "window_closed",
      message: "当前报名窗口未开放，请等待主催开启。",
    });
  });

  it("blocks updating a pending application while the application window is closed", async () => {
    const { resolvePortalApplicationMutation } = await import("./portal-application");

    expect(resolvePortalApplicationMutation("pending", false)).toEqual({
      mode: "update",
      editable: false,
      reason: "window_closed",
      message: "当前报名窗口未开放，请等待主催开启。",
    });
  });

  it("locks an approved application from further edits", async () => {
    const { resolvePortalApplicationMutation } = await import("./portal-application");

    expect(resolvePortalApplicationMutation("approved", true)).toEqual({
      mode: "locked",
      editable: false,
      reason: "approved",
      message: "该报名已审核通过，当前不再允许通过作者页面修改。",
    });
  });

  it("keeps approved applications locked even if the application window is closed", async () => {
    const { resolvePortalApplicationMutation } = await import("./portal-application");

    expect(resolvePortalApplicationMutation("approved", false)).toEqual({
      mode: "locked",
      editable: false,
      reason: "approved",
      message: "该报名已审核通过，当前不再允许通过作者页面修改。",
    });
  });
});

describe("resolvePortalApplicationProfileRequirement", () => {
  it("blocks application editing until the portal profile is completed", async () => {
    const { resolvePortalApplicationProfileRequirement } = await import("./portal-application");

    expect(resolvePortalApplicationProfileRequirement(null)).toEqual({
      ok: false,
      code: "portal_profile_required",
      status: 409,
      message: "请先补充联系资料，再填写报名资料。",
    });
  });

  it("allows application editing after the portal profile is completed", async () => {
    const { resolvePortalApplicationProfileRequirement } = await import("./portal-application");

    expect(resolvePortalApplicationProfileRequirement({ userId: "user_1" })).toEqual({
      ok: true,
    });
  });
});
