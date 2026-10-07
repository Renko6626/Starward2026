import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  buildLocalSeedSql,
  createSignedSessionCookieValue,
  localDevSeedFixtures,
  readBetterAuthSecret,
} from "../../scripts/lib/local-dev-bootstrap.mjs";

describe("local dev bootstrap fixtures", () => {
  it("reads the same unquoted secret as Wrangler from .dev.vars", () => {
    const directory = mkdtempSync(join(tmpdir(), "starward-dev-vars-"));
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    try {
      writeFileSync(join(directory, ".dev.vars"), 'BETTER_AUTH_SECRET="local-session-signing-secret"\n');
      expect(readBetterAuthSecret(directory)).toBe("local-session-signing-secret");
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { recursive: true });
    }
  });
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

  it("keeps development windows open without expiring fixture dates", () => {
    const developmentWindows = localDevSeedFixtures.eventWindows.filter(
      (window) => window.key !== "public_release_open",
    );
    expect(developmentWindows).toHaveLength(5);
    for (const window of developmentWindows) {
      expect(window).toMatchObject({
        is_enabled: 1,
        opens_at: null,
        closes_at: null,
      });
    }
    expect(localDevSeedFixtures.eventWindows.find(
      (window) => window.key === "public_release_open",
    )?.is_enabled).toBe(0);
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
