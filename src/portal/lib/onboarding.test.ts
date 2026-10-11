import { describe, expect, it } from "vitest";

describe("resolvePortalEntryDestination", () => {
  it("takes a new registration to the registration workspace, including when account details cannot be read", async () => {
    const { resolvePortalEntryDestination } = await import("./onboarding");

    expect(resolvePortalEntryDestination(null, { newRegistration: true })).toEqual("/portal");
  });

  it("takes a registration with a chosen slot directly to the form", async () => {
    const { resolvePortalEntryDestination } = await import("./onboarding");

    expect(resolvePortalEntryDestination(null, { newRegistration: true, segment: "slot-14" })).toEqual("/portal");
  });

  it("keeps ordinary sign-ins on the workspace when account details cannot be read", async () => {
    const { resolvePortalEntryDestination } = await import("./onboarding");

    expect(resolvePortalEntryDestination(null)).toEqual("/portal");
  });

  it("takes a new account without an application to the registration workspace", async () => {
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
      }, { newRegistration: true }),
    ).toEqual("/portal");
  });

  it("keeps profiled applicants in the single workspace", async () => {
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
          creditName: "示例",
          contactEmail: "profiled@example.com",
          primaryContactChannel: "Discord",
          primaryContactHandle: "@sample",
          backupContact: null,
          isAnonymous: false,
          updatedAt: "2026-04-12T00:00:00.000Z",
        },
        application: null,
      }),
    ).toEqual("/portal");
  });

  it("keeps pending creators in the single workspace", async () => {
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
          creditName: "示例",
          contactEmail: "ready@example.com",
          primaryContactChannel: "Discord",
          primaryContactHandle: "@ready",
          backupContact: null,
          isAnonymous: false,
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
          creditName: "示例",
          contactEmail: "approved@example.com",
          primaryContactChannel: "Discord",
          primaryContactHandle: "@approved",
          backupContact: null,
          isAnonymous: false,
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
