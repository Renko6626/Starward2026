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
        participant: {
          id: "part_1",
          displayName: "first",
          inviteEmail: "first@example.com",
          contactHandle: null,
          status: "pending",
          activatedAt: "2026-04-12T00:00:00.000Z",
          currentSegmentCode: null,
          currentSegmentName: null,
          updatedAt: "2026-04-12T00:00:00.000Z",
        },
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
        participant: {
          id: "part_2",
          displayName: "profiled",
          inviteEmail: "profiled@example.com",
          contactHandle: null,
          status: "pending",
          activatedAt: "2026-04-12T00:00:00.000Z",
          currentSegmentCode: null,
          currentSegmentName: null,
          updatedAt: "2026-04-12T00:00:00.000Z",
        },
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

  it("sends pending creators with profile and application into the project workspace", async () => {
    const { resolvePortalEntryDestination } = await import("./onboarding");

    expect(
      resolvePortalEntryDestination({
        user: {
          id: "user_3",
          email: "ready@example.com",
          name: "ready",
          emailVerified: true,
        },
        participant: {
          id: "part_3",
          displayName: "ready",
          inviteEmail: "ready@example.com",
          contactHandle: "@ready",
          status: "pending",
          activatedAt: "2026-04-12T00:00:00.000Z",
          currentSegmentCode: null,
          currentSegmentName: null,
          updatedAt: "2026-04-12T00:00:00.000Z",
        },
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
    ).toEqual("/portal/project");
  });

  it("keeps approved creators with profile and application on the dashboard", async () => {
    const { resolvePortalEntryDestination } = await import("./onboarding");

    expect(
      resolvePortalEntryDestination({
        user: {
          id: "user_4",
          email: "approved@example.com",
          name: "approved",
          emailVerified: true,
        },
        participant: {
          id: "part_4",
          displayName: "approved",
          inviteEmail: "approved@example.com",
          contactHandle: "@approved",
          status: "approved",
          activatedAt: "2026-04-12T00:00:00.000Z",
          currentSegmentCode: null,
          currentSegmentName: null,
          updatedAt: "2026-04-12T00:00:00.000Z",
        },
        profile: {
          penName: "示例",
          contactEmail: "approved@example.com",
          primaryContactChannel: "Discord",
          primaryContactHandle: "@approved",
          backupContact: null,
          publicCreditMode: "named",
          publicCreditName: null,
          updatedAt: "2026-04-12T00:00:00.000Z",
        },
        application: {
          id: "app_2",
          displayName: "示例",
          contactEmail: "approved@example.com",
          contactHandle: "@approved",
          interestFormat: "novel",
          status: "approved",
          updatedAt: "2026-04-12T00:00:00.000Z",
          reviewedAt: "2026-04-12T01:00:00.000Z",
        },
      }),
    ).toEqual("/portal");
  });
});
