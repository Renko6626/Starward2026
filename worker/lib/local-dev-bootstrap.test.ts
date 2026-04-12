import { describe, expect, it } from "vitest";
import {
  buildLocalSeedSql,
  createSignedSessionCookieValue,
  localDevSeedFixtures,
} from "../../scripts/lib/local-dev-bootstrap.mjs";

describe("local dev bootstrap fixtures", () => {
  it("defines admin and portal smoke personas", () => {
    expect(localDevSeedFixtures.applications.map((item) => item.id)).toEqual([
      "app_seed_portal_pending",
      "app_seed_portal_approved",
    ]);
    expect(localDevSeedFixtures.portalSessions.map((item) => item.slug)).toEqual([
      "pending-review",
      "approved-participant",
    ]);
  });

  it("builds seed SQL covering the core local smoke tables", () => {
    const sql = buildLocalSeedSql();

    expect(sql).toContain("DELETE FROM participant_events");
    expect(sql).toContain("INSERT INTO applications");
    expect(sql).toContain("INSERT INTO portal_profiles");
    expect(sql).toContain("INSERT INTO participants");
    expect(sql).toContain("INSERT INTO schedule_segments");
    expect(sql).toContain("INSERT INTO project_drafts");
    expect(sql).toContain("INSERT INTO session");
  });

  it("signs Better Auth session cookies for local portal smoke", async () => {
    const signed = await createSignedSessionCookieValue({
      sessionToken: "starward-local-approved-session",
      secret: "0123456789abcdef0123456789abcdef",
    });

    expect(signed).toMatch(/^starward-local-approved-session\./);
    expect(signed).not.toBe("starward-local-approved-session");
  });
});
