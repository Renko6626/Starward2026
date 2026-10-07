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
  async run() {
    this.database.prepare(this.sql).run(...this.params);
    return {
      success: true,
      meta: {
        changes: 1,
        last_row_id: 0,
      },
    };
  }
}
class SqliteD1Database {
  readonly sqlite = new DatabaseSync(":memory:");
  constructor() {
    this.sqlite.exec(`
      CREATE TABLE portal_profiles (user_id TEXT PRIMARY KEY, credit_name TEXT NOT NULL, bilibili_uid TEXT, is_anonymous INTEGER NOT NULL);
      CREATE TABLE schedule_versions (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE schedule_segments (
        scheduled_at TEXT,
        id TEXT PRIMARY KEY,
        schedule_version_id TEXT NOT NULL,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        current_participant_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE participants (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE,
        application_id TEXT,
        invite_email TEXT NOT NULL UNIQUE,
        contact_handle TEXT,
        status TEXT NOT NULL,
        invited_at TEXT,
        activated_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE participant_events (
        id TEXT PRIMARY KEY,
        participant_id TEXT NOT NULL,
        actor_type TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        payload_json TEXT,
        created_at TEXT NOT NULL
      );
    `);
  }
  prepare(sql: string) {
    return new SqlitePreparedStatement(this.sqlite, sql);
  }
  async batch(statements: SqlitePreparedStatement[]) {
    this.sqlite.exec("BEGIN");
    try {
      for (const statement of statements) {
        await statement.run();
      }
      this.sqlite.exec("COMMIT");
      return [];
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}
describe("isParticipantPortalEligible", () => {
  it("treats only approved and completed as participant-action-ready qualification states", async () => {
    const { isParticipantPortalEligible } = await import("./participants");
    expect(isParticipantPortalEligible("pending")).toBe(false);
    expect(isParticipantPortalEligible("approved")).toBe(true);
    expect(isParticipantPortalEligible("completed")).toBe(true);
    expect(isParticipantPortalEligible("withdrawn")).toBe(false);
  });
});
describe("ensureParticipantForAuthUser", () => {
  it("creates a pending creator workspace on first successful OTP login", async () => {
    const database = new SqliteD1Database();
    const { ensureParticipantForAuthUser } = await import("./participants");
    const result = await ensureParticipantForAuthUser(
      database as unknown as D1Database,
      {
        email: "creator@example.com",
        userId: "user_creator",
      },
    );
    expect(result.kind).toBe("linked");
    const participant = database.sqlite
      .prepare(
        `SELECT user_id, invite_email, status, activated_at
         FROM participants
         WHERE user_id = ?`,
      )
      .get("user_creator") as {
      user_id: string;
      invite_email: string;
      display_name: string;
      status: string;
      activated_at: string | null;
    };
    const event = database.sqlite
      .prepare(
        `SELECT event_type FROM participant_events WHERE participant_id = (SELECT id FROM participants WHERE user_id = ?)`,
      )
      .get("user_creator") as {
      event_type: string;
    };
    expect(participant.user_id).toBe("user_creator");
    expect(participant.invite_email).toBe("creator@example.com");
    expect(participant.status).toBe("pending");
    expect(participant.activated_at).not.toBeNull();
    expect(event.event_type).toBe("portal_activated");
  });
});
