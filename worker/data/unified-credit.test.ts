import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { expect, it } from "vitest";
import { buildLocalSeedSql } from "../../scripts/lib/local-dev-bootstrap.mjs";
import {
  getPortalProfileByUserId,
  upsertPortalProfile,
} from "./portal-profiles";
import { getParticipantByUserId } from "./participants";
import {
  getPortalApplicationByUserId,
  listApplications,
  reviewApplication,
} from "./applications";
import {
  getParticipantDetail,
  listParticipants,
  listProjectDrafts,
} from "./admin";
import {
  getPortalProjectDraftDetail,
  submitPortalProjectPreview,
} from "./project-drafts";

class Statement {
  constructor(
    private db: DatabaseSync,
    private sql: string,
    private params: SQLInputValue[] = [],
  ) {}
  bind(...params: SQLInputValue[]) {
    return new Statement(this.db, this.sql, params);
  }
  async first<T>() {
    return (
      (this.db.prepare(this.sql).get(...this.params) as T | undefined) ?? null
    );
  }
  async all() {
    return { results: this.db.prepare(this.sql).all(...this.params) };
  }
  async run() {
    return this.db.prepare(this.sql).run(...this.params);
  }
}
class TestD1 {
  sqlite = new DatabaseSync(":memory:");
  prepare(sql: string) {
    return new Statement(this.sqlite, sql);
  }
  async batch(statements: Statement[]) {
    this.sqlite.exec("BEGIN");
    try {
      for (const statement of statements) await statement.run();
      this.sqlite.exec("COMMIT");
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
    return [];
  }
}

it("uses one live profile credit across application, participant and draft reads, including anonymous submission", async () => {
  const database = new TestD1();
  const db = database as unknown as D1Database;
  try {
    for (const file of readdirSync("migrations")
      .filter((name) => name.endsWith(".sql"))
      .sort()) {
      database.sqlite.exec(readFileSync(`migrations/${file}`, "utf8"));
    }
    database.sqlite.exec(buildLocalSeedSql());
    const profile = await getPortalProfileByUserId(db, "usr_seed_active");
    expect(profile).not.toBeNull();
    for (const isAnonymous of [true, false]) {
      await upsertPortalProfile(db, {
        userId: "usr_seed_active",
        data: {
          ...profile!,
          creditName: "统一署名",
          isAnonymous,
          backupContact: undefined,
        },
      });
      expect(
        (await getParticipantByUserId(db, "usr_seed_active"))?.display_name,
      ).toBe("统一署名");
      expect(
        (await getPortalApplicationByUserId(db, "usr_seed_active"))
          ?.displayName,
      ).toBe("统一署名");
      expect(
        (await listApplications(db)).find(
          (row) => row.id === "app_seed_portal_approved",
        )?.displayName,
      ).toBe("统一署名");
      expect(
        (await listParticipants(db)).find(
          (row) => row.id === "part_seed_active",
        )?.displayName,
      ).toBe("统一署名");
      expect(await getParticipantDetail(db, "part_seed_active")).toMatchObject({
        displayName: "统一署名",
        isAnonymous,
      });
      const publicName = isAnonymous ? "匿名" : "统一署名";
      expect(
        (await getPortalProjectDraftDetail(db, "part_seed_active"))
          ?.publicAuthorName,
      ).toBe(publicName);
      expect(
        (await listProjectDrafts(db)).find(
          (row) => row.participantId === "part_seed_active",
        )?.publicAuthorName,
      ).toBe(publicName);
      const participant = await getParticipantByUserId(db, "usr_seed_active");
      const result = await submitPortalProjectPreview(db, {
        participant: participant!,
        windows: [
          {
            key: "preview_submit_open",
            label: "预告提交",
            isEnabled: true,
            isOpen: true,
            state: "open",
            opensAt: null,
            closesAt: null,
            updatedAt: "2026-09-29T00:00:00Z",
          },
        ],
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.draft.publicAuthorName).toBe(publicName);
    }
    const reviewed = await reviewApplication(
      db,
      "app_seed_portal_pending",
      { status: "approved" },
      "admin@test.local",
    );
    expect(reviewed?.displayName).toBe("宇佐见莲子");
    expect(
      (await getParticipantDetail(db, "part_seed_pending"))?.displayName,
    ).toBe("宇佐见莲子");
    for (const [table, removed] of [
      ["applications", "display_name"],
      ["participants", "display_name"],
      ["project_drafts", "public_author_name"],
    ]) {
      expect(
        database.sqlite
          .prepare(`PRAGMA table_info(${table})`)
          .all()
          .map((row) => row.name),
      ).not.toContain(removed);
    }
  } finally {
    database.sqlite.close();
  }
});
