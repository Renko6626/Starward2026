import { describe, expect, it } from "vitest";
import { updatePortalProfileInputSchema } from "../../shared/portal";
import { normalizePortalProfileInput } from "./profile-form";

const profile = {
  creditName: "  境界观测者  ",
  isAnonymous: true,
  contactEmail: "  MERRY@example.com  ",
  primaryContactChannel: "  Discord  ",
  primaryContactHandle: "  @merry  ",
  backupContact: "  ",
};

describe("unified credit settings", () => {
  it("normalizes one credit name without discarding it for anonymous display", () => {
    expect(normalizePortalProfileInput(profile)).toEqual({
      creditName: "境界观测者",
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
