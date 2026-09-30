import { describe, expect, it } from "vitest";
import type { CreateApplicationInput } from "../../shared/applications";
import { getTurnstileSiteKey, normalizeApplicationInput } from "./apply-form";

describe("normalizeApplicationInput", () => {
  it("preserves a trimmed optional display name and turnstile token when present", () => {
    const input: CreateApplicationInput = {
      contactEmail: "  alice@example.com  ",
      contactHandle: "  Discord: alice  ",
      interestFormat: "novel",
      introText: "  intro  ",
      portfolioUrl: "  https://example.com  ",
      messageToHosts: "  hi  ",
      turnstileToken: "  token-123  ",
    };

    expect(normalizeApplicationInput(input)).toEqual({
      contactEmail: "alice@example.com",
      contactHandle: "Discord: alice",
      interestFormat: "novel",
      introText: "intro",
      portfolioUrl: "https://example.com",
      messageToHosts: "hi",
      turnstileToken: "token-123",
    });
  });

  it("drops empty optional fields, including an empty display name and turnstile token", () => {
    const input: CreateApplicationInput = {
      contactEmail: "alice@example.com",
      contactHandle: "   ",
      interestFormat: "illustration",
      introText: "   ",
      portfolioUrl: "",
      messageToHosts: undefined,
      turnstileToken: "   ",
    };

    expect(normalizeApplicationInput(input)).toEqual({
      contactEmail: "alice@example.com",
      contactHandle: undefined,
      interestFormat: "illustration",
      introText: undefined,
      portfolioUrl: undefined,
      messageToHosts: undefined,
      turnstileToken: undefined,
    });
  });
});

describe("getTurnstileSiteKey", () => {
  it("returns a trimmed site key when configured", () => {
    expect(
      getTurnstileSiteKey({
        VITE_TURNSTILE_SITE_KEY: "  0x4AAAAAAC7-OlhD79ptmOIB  ",
      }),
    ).toBe("0x4AAAAAAC7-OlhD79ptmOIB");
  });

  it("returns null when the site key is missing", () => {
    expect(getTurnstileSiteKey({})).toBeNull();
  });
});
