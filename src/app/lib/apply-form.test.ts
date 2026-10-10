import { describe, expect, it } from "vitest";
import type { CreateApplicationInput } from "../../shared/applications";
import { normalizeApplicationInput } from "./apply-form";

describe("normalizeApplicationInput", () => {
  it("trims contact and optional application fields", () => {
    const input: CreateApplicationInput = {
      contactEmail: "  alice@example.com  ",
      contactHandle: "  Discord: alice  ",
      interestFormat: "novel",
      introText: "  intro  ",
      portfolioUrl: "  https://example.com  ",
      messageToHosts: "  hi  ",
    };

    expect(normalizeApplicationInput(input)).toEqual({
      contactEmail: "alice@example.com",
      contactHandle: "Discord: alice",
      interestFormat: "novel",
      introText: "intro",
      portfolioUrl: "https://example.com",
      messageToHosts: "hi",
    });
  });

  it("drops empty optional application fields", () => {
    const input: CreateApplicationInput = {
      contactEmail: "alice@example.com",
      contactHandle: "   ",
      interestFormat: "illustration",
      introText: "   ",
      portfolioUrl: "",
      messageToHosts: undefined,
    };

    expect(normalizeApplicationInput(input)).toEqual({
      contactEmail: "alice@example.com",
      contactHandle: undefined,
      interestFormat: "illustration",
      introText: "",
      portfolioUrl: undefined,
      messageToHosts: undefined,
    });
  });
});
