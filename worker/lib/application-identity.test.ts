import { describe, expect, it } from "vitest";

describe("resolveApplicationDisplayName", () => {
  it("keeps an explicit display name when one is provided", async () => {
    const { resolveApplicationDisplayName } = await import("./application-identity");

    expect(
      resolveApplicationDisplayName({
        displayName: "  博丽灵梦  ",
        contactHandle: "Discord reimu#2026",
        contactEmail: "reimu@example.com",
      }),
    ).toBe("博丽灵梦");
  });

  it("falls back to the contact handle when the applicant leaves the display name blank", async () => {
    const { resolveApplicationDisplayName } = await import("./application-identity");

    expect(
      resolveApplicationDisplayName({
        displayName: "   ",
        contactHandle: "  Discord yukari#2026  ",
        contactEmail: "yukari@example.com",
      }),
    ).toBe("Discord yukari#2026");
  });

  it("falls back to the contact email when both display name and contact handle are blank", async () => {
    const { resolveApplicationDisplayName } = await import("./application-identity");

    expect(
      resolveApplicationDisplayName({
        displayName: undefined,
        contactHandle: "",
        contactEmail: "sumireko@example.com",
      }),
    ).toBe("sumireko@example.com");
  });
});
