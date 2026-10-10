import { describe, expect, it } from "vitest";
import { workspaceApplicationInputSchema } from "../../shared/collaboration";
import { updatePortalProfileInputSchema } from "../../shared/portal";
import { normalizeApplicationInput } from "../../app/lib/apply-form";
import { normalizePortalProfileInput } from "./profile-form";
import { getRegistrationFieldErrors } from "./registration-validation";
import { updateApplicationIntentInputSchema } from "../../shared/applications";

const profile = {
  creditName: "观测者", bilibiliUid: "12345678", contactEmail: "creator@example.com",
  primaryContactChannel: "QQ", primaryContactHandle: "12345", isAnonymous: false,
};
const application = { contactEmail: profile.contactEmail, interestFormat: "novel" as const, introText: "准备写一篇秘封组短篇小说。" };

describe("registration field errors", () => {
  it("points an invalid standalone intent save to its existing form field", () => {
    const result = updateApplicationIntentInputSchema.safeParse({ interestFormat: "novel", introText: "   " });
    expect(result.success).toBe(false);
    if (!result.success) expect(getRegistrationFieldErrors(result.error.issues, "application")).toEqual({ "application.introText": "请简要描述准备创作什么。" });
  });
  it("points to the invalid UID and portfolio link independently", () => {
    const result = workspaceApplicationInputSchema.safeParse({
      profile: normalizePortalProfileInput({ ...profile, bilibiliUid: "作者昵称" }),
      application: { ...application, portfolioUrl: "not-a-link" }, segmentId: "slot-14",
    });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Invalid registration was accepted");
    expect(getRegistrationFieldErrors(result.error.issues)).toEqual({
      "profile.bilibiliUid": "请填写 B站主页链接或数字 UID，不能填写昵称。",
      "application.portfolioUrl": "请填写完整链接，例如 https://example.com/works。",
    });
  });

  it("uses the same field messages when saving only personal information", () => {
    const result = updatePortalProfileInputSchema.safeParse({ ...profile, creditName: " ", primaryContactHandle: "" });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Incomplete profile was accepted");
    expect(getRegistrationFieldErrors(result.error.issues, "profile")).toEqual({
      "profile.creditName": "请填写署名。",
      "profile.primaryContactHandle": "请填写联系账号。",
    });
  });

  it("identifies an overlong creation intention", () => {
    const result = workspaceApplicationInputSchema.safeParse({ profile, application: { ...application, introText: "文".repeat(1601) }, segmentId: "slot-14" });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Overlong introduction was accepted");
    expect(getRegistrationFieldErrors(result.error.issues)).toEqual({ "application.introText": "创作意向最多填写 1600 个字符。" });
  });

  it.each([undefined, "", " \n "])("rejects a missing or blank creation intention (%j)", (introText) => {
    const result = workspaceApplicationInputSchema.safeParse({ profile, application: { ...application, introText }, segmentId: "slot-14" });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Missing creation intention was accepted");
    expect(getRegistrationFieldErrors(result.error.issues)).toEqual({ "application.introText": "请简要描述准备创作什么。" });
  });

  it("accepts and trims a brief creation intention", () => {
    const result = workspaceApplicationInputSchema.parse({ profile, application: normalizeApplicationInput({ ...application, introText: "  准备画一幅莲子和梅莉旅行的插画。  " }), segmentId: "slot-14" });
    expect(result.application.introText).toBe("准备画一幅莲子和梅莉旅行的插画。");
  });

  it("attaches a derived contact-length error to the editable contact account", () => {
    const handle = "1".repeat(118);
    const result = workspaceApplicationInputSchema.safeParse({
      profile: { ...profile, primaryContactHandle: handle },
      application: { ...application, contactHandle: `QQ: ${handle}` }, segmentId: "slot-14",
    });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Overlong contact was accepted");
    expect(getRegistrationFieldErrors(result.error.issues)).toEqual({
      "profile.primaryContactHandle": "联系账号连同联系方式类型最多填写 120 个字符。",
    });
  });
});
