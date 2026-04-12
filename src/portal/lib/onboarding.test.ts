import { describe, expect, it } from "vitest";

describe("resolvePortalEntryDestination", () => {
  it("sends first-time accounts to profile completion", async () => {
    const { resolvePortalEntryDestination } = await import("./onboarding");

    expect(
      resolvePortalEntryDestination({
        user: {
          id: "user_1",
          email: "first@example.com",
          name: "first",
          emailVerified: true,
        },
        participant: null,
        profile: null,
        application: null,
      }),
    ).toEqual("/portal/profile");
  });

  it("sends profiled accounts without an application to the application page", async () => {
    const { resolvePortalEntryDestination } = await import("./onboarding");

    expect(
      resolvePortalEntryDestination({
        user: {
          id: "user_2",
          email: "profiled@example.com",
          name: "profiled",
          emailVerified: true,
        },
        participant: null,
        profile: {
          penName: "示例",
          contactEmail: "profiled@example.com",
          primaryContactChannel: "Discord",
          primaryContactHandle: "@sample",
          backupContact: null,
          publicCreditMode: "named",
          publicCreditName: null,
          updatedAt: "2026-04-12T00:00:00.000Z",
        },
        application: null,
      }),
    ).toEqual("/portal/application");
  });

  it("keeps accounts with profile and application on the dashboard", async () => {
    const { resolvePortalEntryDestination } = await import("./onboarding");

    expect(
      resolvePortalEntryDestination({
        user: {
          id: "user_3",
          email: "ready@example.com",
          name: "ready",
          emailVerified: true,
        },
        participant: null,
        profile: {
          penName: "示例",
          contactEmail: "ready@example.com",
          primaryContactChannel: "Discord",
          primaryContactHandle: "@ready",
          backupContact: null,
          publicCreditMode: "named",
          publicCreditName: null,
          updatedAt: "2026-04-12T00:00:00.000Z",
        },
        application: {
          id: "app_1",
          displayName: "示例",
          contactEmail: "ready@example.com",
          contactHandle: "@ready",
          interestFormat: "novel",
          status: "pending",
          updatedAt: "2026-04-12T00:00:00.000Z",
          reviewedAt: null,
        },
      }),
    ).toEqual("/portal");
  });
});
