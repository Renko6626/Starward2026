import { describe, expect, it } from "vitest";

describe("resolvePortalApplicationMutation", () => {
  it("allows creating an application when the account has not submitted one yet", async () => {
    const { resolvePortalApplicationMutation } = await import("./portal-application");

    expect(resolvePortalApplicationMutation(null)).toEqual({
      mode: "create",
      editable: true,
    });
  });

  it("allows editing a pending application", async () => {
    const { resolvePortalApplicationMutation } = await import("./portal-application");

    expect(resolvePortalApplicationMutation("pending")).toEqual({
      mode: "update",
      editable: true,
    });
  });

  it("locks an approved application from further edits", async () => {
    const { resolvePortalApplicationMutation } = await import("./portal-application");

    expect(resolvePortalApplicationMutation("approved")).toEqual({
      mode: "locked",
      editable: false,
      message: "该报名已审核通过，当前不再允许通过参与者入口修改。",
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
