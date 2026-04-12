import { describe, expect, it } from "vitest";
import type { ApplicationListItem } from "../../shared/applications";

function createApplication(overrides: Partial<ApplicationListItem> = {}): ApplicationListItem {
  return {
    id: "app_1",
    displayName: "示例报名",
    contactEmail: "sample@example.com",
    contactHandle: "@sample",
    interestFormat: "novel",
    status: "pending",
    createdAt: "2026-04-12T00:00:00.000Z",
    reviewedAt: null,
    authUserEmail: null,
    hasPortalProfile: false,
    participantId: null,
    participantStatus: null,
    ...overrides,
  };
}

describe("filterAdminApplications", () => {
  it("keeps only pending items for the pending filter", async () => {
    const { filterAdminApplications } = await import("./application-list");
    const items = [
      createApplication({ id: "app_pending", status: "pending" }),
      createApplication({ id: "app_approved", status: "approved" }),
    ];

    expect(filterAdminApplications(items, { filter: "pending", query: "" }).map((item) => item.id)).toEqual([
      "app_pending",
    ]);
  });

  it("keeps only items without an auth user for the needs-entry filter", async () => {
    const { filterAdminApplications } = await import("./application-list");
    const items = [
      createApplication({ id: "app_public", authUserEmail: null }),
      createApplication({ id: "app_portal", authUserEmail: "portal@example.com" }),
    ];

    expect(filterAdminApplications(items, { filter: "needs-entry", query: "" }).map((item) => item.id)).toEqual([
      "app_public",
    ]);
  });

  it("keeps only portal-entered items without a profile for the needs-profile filter", async () => {
    const { filterAdminApplications } = await import("./application-list");
    const items = [
      createApplication({
        id: "app_waiting_profile",
        authUserEmail: "portal@example.com",
        hasPortalProfile: false,
      }),
      createApplication({
        id: "app_ready",
        authUserEmail: "ready@example.com",
        hasPortalProfile: true,
      }),
      createApplication({
        id: "app_public",
        authUserEmail: null,
        hasPortalProfile: false,
      }),
    ];

    expect(filterAdminApplications(items, { filter: "needs-profile", query: "" }).map((item) => item.id)).toEqual([
      "app_waiting_profile",
    ]);
  });

  it("matches search terms against display name, public contact email, and auth email", async () => {
    const { filterAdminApplications } = await import("./application-list");
    const items = [
      createApplication({
        id: "app_alpha",
        displayName: "八云紫",
        contactEmail: "yakumo@example.com",
      }),
      createApplication({
        id: "app_beta",
        displayName: "宇佐见莲子",
        contactEmail: "renko-public@example.com",
        authUserEmail: "renko-portal@example.com",
      }),
    ];

    expect(filterAdminApplications(items, { filter: "all", query: "莲子" }).map((item) => item.id)).toEqual([
      "app_beta",
    ]);
    expect(filterAdminApplications(items, { filter: "all", query: "portal" }).map((item) => item.id)).toEqual([
      "app_beta",
    ]);
  });
});

describe("buildAdminApplicationFilterCounts", () => {
  it("returns counts for each quick filter bucket", async () => {
    const { buildAdminApplicationFilterCounts } = await import("./application-list");
    const items = [
      createApplication({
        id: "app_pending_public",
        status: "pending",
        authUserEmail: null,
      }),
      createApplication({
        id: "app_needs_profile",
        status: "pending",
        authUserEmail: "portal@example.com",
        hasPortalProfile: false,
      }),
      createApplication({
        id: "app_converted",
        status: "approved",
        authUserEmail: "ready@example.com",
        hasPortalProfile: true,
        participantId: "part_1",
        participantStatus: "approved",
      }),
    ];

    expect(buildAdminApplicationFilterCounts(items)).toEqual({
      all: 3,
      pending: 2,
      "needs-entry": 1,
      "needs-profile": 1,
      converted: 1,
    });
  });
});
