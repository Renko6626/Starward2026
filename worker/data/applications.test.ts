import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

class SqlitePreparedStatement {
  constructor(
    private readonly database: DatabaseSync,
    private readonly sql: string,
    private readonly params: any[] = [],
  ) {}

  bind(...params: any[]) {
    return new SqlitePreparedStatement(this.database, this.sql, params);
  }

  async first<T>() {
    const row = this.database.prepare(this.sql).get(...this.params);
    return (row as T | undefined) ?? null;
  }

  async all<T>() {
    const rows = this.database.prepare(this.sql).all(...this.params);
    return {
      results: rows as T[],
      success: true,
      meta: {
        changes: 0,
        last_row_id: 0,
      },
    };
  }
}

class SqliteD1Database {
  readonly sqlite = new DatabaseSync(":memory:");

  constructor() {
    this.sqlite.exec(`
      CREATE TABLE "user" (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL
      );

      CREATE TABLE portal_profiles (
        user_id TEXT PRIMARY KEY,
        pen_name TEXT,
        contact_email TEXT NOT NULL,
        primary_contact_channel TEXT NOT NULL,
        primary_contact_handle TEXT NOT NULL,
        backup_contact TEXT,
        public_credit_mode TEXT NOT NULL,
        public_credit_name TEXT
      );

      CREATE TABLE applications (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        display_name TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        contact_handle TEXT,
        interest_format TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        reviewed_at TEXT,
        intro_text TEXT,
        portfolio_url TEXT,
        message_to_hosts TEXT,
        admin_note TEXT,
        reviewed_by TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE participants (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE,
        application_id TEXT,
        invite_email TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        contact_handle TEXT,
        status TEXT NOT NULL,
        invited_at TEXT,
        activated_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  prepare(sql: string) {
    return new SqlitePreparedStatement(this.sqlite, sql);
  }
}

function seedPendingWorkspaceWithoutApplicationLink(database: SqliteD1Database) {
  database.sqlite
    .prepare(`INSERT INTO "user" (id, email) VALUES (?, ?)`)
    .run("user_creator", "creator@example.com");

  database.sqlite
    .prepare(
      `INSERT INTO portal_profiles (
        user_id,
        pen_name,
        contact_email,
        primary_contact_channel,
        primary_contact_handle,
        backup_contact,
        public_credit_mode,
        public_credit_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "user_creator",
      "境界观测者",
      "creator@example.com",
      "Discord",
      "@creator",
      null,
      "anonymous",
      null,
    );

  database.sqlite
    .prepare(
      `INSERT INTO applications (
        id,
        user_id,
        display_name,
        contact_email,
        contact_handle,
        interest_format,
        status,
        created_at,
        reviewed_at,
        intro_text,
        portfolio_url,
        message_to_hosts,
        admin_note,
        reviewed_by,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "app_creator",
      "user_creator",
      "境界观测者",
      "creator@example.com",
      "@creator",
      "novel",
      "pending",
      "2026-04-12T00:00:00.000Z",
      null,
      "intro",
      "https://example.com",
      "message",
      null,
      null,
      "2026-04-12T00:00:00.000Z",
    );

  database.sqlite
    .prepare(
      `INSERT INTO participants (
        id,
        user_id,
        application_id,
        invite_email,
        display_name,
        contact_handle,
        status,
        invited_at,
        activated_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "part_creator",
      "user_creator",
      null,
      "creator@example.com",
      "境界观测者",
      "@creator",
      "pending",
      null,
      "2026-04-12T08:00:00.000Z",
      "2026-04-12T08:00:00.000Z",
      "2026-04-12T08:00:00.000Z",
    );
}

describe("application workspace association", () => {
  it("associates pending workspaces by portal identity before approval fills application_id", async () => {
    const database = new SqliteD1Database();
    const { getApplicationDetail, listApplications } = await import("./applications");

    seedPendingWorkspaceWithoutApplicationLink(database);

    const detail = await getApplicationDetail(database as unknown as D1Database, "app_creator");
    const list = await listApplications(database as unknown as D1Database);

    expect(detail?.participant).toEqual({
      id: "part_creator",
      inviteEmail: "creator@example.com",
      status: "pending",
      activatedAt: "2026-04-12T08:00:00.000Z",
    });
    expect(detail?.participantId).toBe("part_creator");
    expect(detail?.participantStatus).toBe("pending");
    expect(list[0]).toMatchObject({
      id: "app_creator",
      participantId: "part_creator",
      participantStatus: "pending",
    });
  });
});
