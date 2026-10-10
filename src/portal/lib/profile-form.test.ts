import { describe, expect, it } from "vitest";
import { updatePortalProfileInputSchema } from "../../shared/portal";
import { getBilibiliProfileUrl, normalizePortalProfileInput } from "./profile-form";

const profile = {
  creditName: "  境界观测者  ",
  bilibiliUid: "  12345678  ",
  isAnonymous: true,
  contactEmail: "  MERRY@example.com  ",
  primaryContactChannel: "  Discord  ",
  primaryContactHandle: "  @merry  ",
  backupContact: "  ",
};

describe("unified credit settings", () => {
  it("preserves contact email independently of the registration email", () => {
    expect(normalizePortalProfileInput(profile, "REGISTERED@example.com").contactEmail).toBe("merry@example.com");
  });
  it("extracts the UID from a homepage link with a share query or subpage", () => {
    const normalized = normalizePortalProfileInput({ ...profile, bilibiliUid: " https://space.bilibili.com/12345678/dynamic?spm_id_from=333.999 " });
    expect(normalized.bilibiliUid).toBe("12345678");
    expect(updatePortalProfileInputSchema.safeParse(normalized).success).toBe(true);
    expect(getBilibiliProfileUrl("space.bilibili.com/12345678")).toBe("https://space.bilibili.com/12345678");
  });
  it("rejects unrelated URLs and nicknames instead of guessing a UID", () => {
    for (const value of ["https://space.bilibili.com.example.org/12345678", "https://example.org/12345678", "https://space.bilibili.com/昵称", "https://b23.tv/test"]) {
      const normalized = normalizePortalProfileInput({ ...profile, bilibiliUid: value });
      expect(updatePortalProfileInputSchema.safeParse(normalized).success).toBe(false);
      expect(getBilibiliProfileUrl(value)).toBeUndefined();
    }
  });
  it("keeps large numeric UIDs intact when generating a homepage link", () => {
    expect(getBilibiliProfileUrl(" 12345678901234567890 ")).toBe("https://space.bilibili.com/12345678901234567890");
  });
  it("requires a numeric Bilibili UID instead of a nickname", () => {
    const normalized = normalizePortalProfileInput(profile);
    expect(updatePortalProfileInputSchema.safeParse({ ...normalized, bilibiliUid: "" }).success).toBe(false);
    expect(updatePortalProfileInputSchema.safeParse({ ...normalized, bilibiliUid: "境界观测者" }).success).toBe(false);
    expect(updatePortalProfileInputSchema.safeParse({ ...normalized, bilibiliUid: "12345678" }).success).toBe(true);
  });
  it("normalizes one credit name without discarding it for anonymous display", () => {
    expect(normalizePortalProfileInput(profile)).toEqual({
      creditName: "境界观测者",
      bilibiliUid: "12345678",
      isAnonymous: true,
      contactEmail: "merry@example.com",
      primaryContactChannel: "Discord",
      primaryContactHandle: "@merry",
      backupContact: undefined,
    });
  });
  it.each([true, false])(
    "requires a credit name when anonymous=%s",
    (isAnonymous) => {
      expect(
        updatePortalProfileInputSchema.safeParse({
          ...profile,
          contactEmail: "merry@example.com",
          creditName: " ",
          isAnonymous,
        }).success,
      ).toBe(false);
      expect(
        updatePortalProfileInputSchema.safeParse({
          ...profile,
          contactEmail: "merry@example.com",
          isAnonymous,
        }).success,
      ).toBe(true);
    },
  );
});
