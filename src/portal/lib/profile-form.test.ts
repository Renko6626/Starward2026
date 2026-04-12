import { describe, expect, it } from "vitest";
import {
  type UpdatePortalProfileInput,
  updatePortalProfileInputSchema,
} from "../../shared/portal";
import { normalizePortalProfileInput } from "./profile-form";

describe("normalizePortalProfileInput", () => {
  it("trims profile fields and preserves explicit public credit name", () => {
    const input: UpdatePortalProfileInput = {
      penName: "  玛艾露贝莉  ",
      contactEmail: "  merry@example.com  ",
      primaryContactChannel: "  Bluesky  ",
      primaryContactHandle: "  @merry  ",
      backupContact: "  Telegram: merry_alt  ",
      publicCreditMode: "pseudonymous",
      publicCreditName: "  赫恩幻名  ",
    };

    expect(normalizePortalProfileInput(input)).toEqual({
      penName: "玛艾露贝莉",
      contactEmail: "merry@example.com",
      primaryContactChannel: "Bluesky",
      primaryContactHandle: "@merry",
      backupContact: "Telegram: merry_alt",
      publicCreditMode: "pseudonymous",
      publicCreditName: "赫恩幻名",
    });
  });

  it("drops empty pen name and other optional values for anonymous mode", () => {
    const input: UpdatePortalProfileInput = {
      penName: "   ",
      contactEmail: "renko@example.com",
      primaryContactChannel: "Email",
      primaryContactHandle: "renko@example.com",
      backupContact: "   ",
      publicCreditMode: "anonymous",
      publicCreditName: "   ",
    };

    expect(normalizePortalProfileInput(input)).toEqual({
      penName: undefined,
      contactEmail: "renko@example.com",
      primaryContactChannel: "Email",
      primaryContactHandle: "renko@example.com",
      backupContact: undefined,
      publicCreditMode: "anonymous",
      publicCreditName: undefined,
    });
  });

  it("clears public credit name when using the regular pen name", () => {
    const input: UpdatePortalProfileInput = {
      penName: "爱丽丝",
      contactEmail: "alice@example.com",
      primaryContactChannel: "Discord",
      primaryContactHandle: "alice#1234",
      backupContact: "",
      publicCreditMode: "named",
      publicCreditName: "不应保留",
    };

    expect(normalizePortalProfileInput(input)).toEqual({
      penName: "爱丽丝",
      contactEmail: "alice@example.com",
      primaryContactChannel: "Discord",
      primaryContactHandle: "alice#1234",
      backupContact: undefined,
      publicCreditMode: "named",
      publicCreditName: undefined,
    });
  });

  it("allows anonymous mode without a pen name", () => {
    const result = updatePortalProfileInputSchema.safeParse({
      penName: "",
      contactEmail: "anonymous@example.com",
      primaryContactChannel: "Discord",
      primaryContactHandle: "anon#2026",
      publicCreditMode: "anonymous",
      publicCreditName: "",
    } satisfies UpdatePortalProfileInput);

    expect(result.success).toBe(true);
  });

  it("rejects pseudonymous mode without a public credit name", () => {
    const result = updatePortalProfileInputSchema.safeParse({
      penName: "",
      contactEmail: "alice@example.com",
      primaryContactChannel: "Discord",
      primaryContactHandle: "alice#1234",
      publicCreditMode: "pseudonymous",
      publicCreditName: "",
    } satisfies UpdatePortalProfileInput);

    expect(result.success).toBe(false);
  });

  it("rejects named mode without a pen name", () => {
    const result = updatePortalProfileInputSchema.safeParse({
      penName: "",
      contactEmail: "named@example.com",
      primaryContactChannel: "Discord",
      primaryContactHandle: "named#1234",
      publicCreditMode: "named",
      publicCreditName: "",
    } satisfies UpdatePortalProfileInput);

    expect(result.success).toBe(false);
  });
});
