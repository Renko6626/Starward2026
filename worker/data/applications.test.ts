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
  async run() {
    const result = this.database.prepare(this.sql).run(...this.params);
    return {
      success: true,
      meta: {
        changes: Number(result.changes ?? 0),
        last_row_id: Number(result.lastInsertRowid ?? 0),
      },
    };
  }
}
class SqliteD1Database {
  readonly sqlite = new DatabaseSync(":memory:");
  async batch(statements: SqlitePreparedStatement[]) {
    this.sqlite.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) {
        results.push(await statement.run());
      }
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
  constructor() {
    this.sqlite.exec(`
      CREATE TABLE "user" (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL
      );

      CREATE TABLE schedule_segments (
        id TEXT PRIMARY KEY,
        schedule_version_id TEXT NOT NULL,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        current_participant_id TEXT,
        claimed_at TEXT,
        released_at TEXT,
        sort_order INTEGER NOT NULL,
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
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE project_drafts (
        id TEXT PRIMARY KEY,
        participant_id TEXT NOT NULL UNIQUE,
        segment_id TEXT,
        preview_status TEXT NOT NULL,
        review_status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE portal_profiles (
        user_id TEXT PRIMARY KEY,
        credit_name TEXT,
        contact_email TEXT NOT NULL,
        primary_contact_channel TEXT NOT NULL,
        primary_contact_handle TEXT NOT NULL,
        backup_contact TEXT,
        is_anonymous INTEGER NOT NULL
      );

      CREATE TABLE applications (
        id TEXT PRIMARY KEY,
        user_id TEXT,
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
        contact_handle TEXT,
        status TEXT NOT NULL,
        invited_at TEXT,
        activated_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX uq_applications_user_id
        ON applications(user_id) WHERE user_id IS NOT NULL;
    `);
  }
  prepare(sql: string) {
    return new SqlitePreparedStatement(this.sqlite, sql);
  }
}
function seedPendingWorkspaceWithoutApplicationLink(
  database: SqliteD1Database,
) {
  database.sqlite
    .prepare(`INSERT INTO "user" (id, email) VALUES (?, ?)`)
    .run("user_creator", "creator@example.com");
  database.sqlite
    .prepare(
      `INSERT INTO portal_profiles (
        user_id,
        credit_name,
        contact_email,
        primary_contact_channel,
        primary_contact_handle,
        backup_contact,
        is_anonymous
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "user_creator",
      "境界观测者",
      "creator@example.com",
      "Discord",
      "@creator",
      null,
      1,
    );
  database.sqlite
    .prepare(
      `INSERT INTO applications (id, user_id, contact_email, contact_handle, interest_format, status, created_at, reviewed_at, intro_text, portfolio_url, message_to_hosts, admin_note, reviewed_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "app_creator",
      "user_creator",
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
      `INSERT INTO participants (id, user_id, application_id, invite_email, contact_handle, status, invited_at, activated_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "part_creator",
      "user_creator",
      null,
      "creator@example.com",
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
    const { getApplicationDetail, listApplications } =
      await import("./applications");
    seedPendingWorkspaceWithoutApplicationLink(database);
    const detail = await getApplicationDetail(
      database as unknown as D1Database,
      "app_creator",
    );
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
function seedApprovedParticipantHoldingSegment(database: SqliteD1Database) {
  database.sqlite
    .prepare(`INSERT INTO "user" (id, email) VALUES (?, ?)`)
    .run("user_appr", "approved@example.com");
  database.sqlite
    .prepare(
      `INSERT INTO applications (id, user_id, contact_email, contact_handle, interest_format, status, created_at, reviewed_at, intro_text, portfolio_url, message_to_hosts, admin_note, reviewed_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "app_appr",
      "user_appr",
      "approved@example.com",
      "@appr",
      "novel",
      "approved",
      "2026-04-12T00:00:00.000Z",
      "2026-04-12T01:00:00.000Z",
      "intro",
      null,
      null,
      null,
      "admin@example.com",
      "2026-04-12T01:00:00.000Z",
    );
  database.sqlite
    .prepare(
      `INSERT INTO participants (id, user_id, application_id, invite_email, contact_handle, status, invited_at, activated_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?)`,
    )
    .run(
      "part_appr",
      "user_appr",
      "app_appr",
      "approved@example.com",
      "@appr",
      "2026-04-12T01:00:00.000Z",
      "2026-04-12T01:00:00.000Z",
      "2026-04-12T01:00:00.000Z",
      "2026-04-12T01:00:00.000Z",
    );
  database.sqlite
    .prepare(
      `INSERT INTO schedule_segments (
        id, schedule_version_id, code, name, description, status,
        current_participant_id, claimed_at, released_at, sort_order, created_at, updated_at
      ) VALUES (?, 'sched_active', ?, ?, NULL, 'held', ?, ?, NULL, 1, ?, ?)`,
    )
    .run(
      "seg_held",
      "CODE-1",
      "段一",
      "part_appr",
      "2026-04-12T02:00:00.000Z",
      "2026-04-12T00:00:00.000Z",
      "2026-04-12T02:00:00.000Z",
    );
  database.sqlite
    .prepare(
      `INSERT INTO project_drafts (id, participant_id, segment_id, preview_status, review_status, created_at, updated_at) VALUES (?, ?, ?, 'not_started', 'not_started', ?, ?)`,
    )
    .run(
      "draft_appr",
      "part_appr",
      "seg_held",
      "2026-04-12T02:00:00.000Z",
      "2026-04-12T02:00:00.000Z",
    );
}
describe("reviewApplication lifecycle", () => {
  it("revokes the participant and releases their held segment when an approved application is rejected", async () => {
    const database = new SqliteD1Database();
    const { reviewApplication } = await import("./applications");
    seedApprovedParticipantHoldingSegment(database);
    await reviewApplication(
      database as unknown as D1Database,
      "app_appr",
      { status: "rejected", adminNote: undefined },
      "admin@example.com",
    );
    const participant = database.sqlite
      .prepare(`SELECT status FROM participants WHERE id = ?`)
      .get("part_appr") as {
      status: string;
    };
    const segment = database.sqlite
      .prepare(
        `SELECT status, current_participant_id FROM schedule_segments WHERE id = ?`,
      )
      .get("seg_held") as {
      status: string;
      current_participant_id: string | null;
    };
    expect(participant.status).toBe("withdrawn");
    expect(segment.status).toBe("released");
    expect(segment.current_participant_id).toBeNull();
  });
  it("does not approve a participant owned by a different user that merely shares the contact email", async () => {
    const database = new SqliteD1Database();
    const { reviewApplication } = await import("./applications");
    // Bob already has a pending participant tied to his own account.
    database.sqlite
      .prepare(`INSERT INTO "user" (id, email) VALUES (?, ?)`)
      .run("user_bob", "shared@example.com");
    database.sqlite
      .prepare(
        `INSERT INTO participants (id, user_id, application_id, invite_email, contact_handle, status, invited_at, activated_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      )
      .run(
        "part_bob",
        "user_bob",
        null,
        "shared@example.com",
        null,
        null,
        null,
        "2026-04-12T00:00:00.000Z",
        "2026-04-12T00:00:00.000Z",
      );
    // An anonymous application typed Bob's email as its contact email.
    database.sqlite
      .prepare(
        `INSERT INTO applications (id, user_id, contact_email, contact_handle, interest_format, status, created_at, reviewed_at, intro_text, portfolio_url, message_to_hosts, admin_note, reviewed_by, updated_at) VALUES (?, NULL, ?, NULL, 'novel', 'pending', ?, NULL, NULL, NULL, NULL, NULL, NULL, ?)`,
      )
      .run(
        "app_anon",
        "shared@example.com",
        "2026-04-12T00:00:00.000Z",
        "2026-04-12T00:00:00.000Z",
      );
    await expect(
      reviewApplication(
        database as unknown as D1Database,
        "app_anon",
        { status: "approved", adminNote: undefined },
        "admin@example.com",
      ),
    ).rejects.toThrow();
    const bob = database.sqlite
      .prepare(`SELECT status FROM participants WHERE id = ?`)
      .get("part_bob") as {
      status: string;
    };
    expect(bob.status).toBe("pending");
  });
});
describe("getPortalApplicationByUserId", () => {
  it("is read-only and never claims an unlinked application by contact email", async () => {
    const database = new SqliteD1Database();
    const { getPortalApplicationByUserId } = await import("./applications");
    database.sqlite
      .prepare(`INSERT INTO "user" (id, email) VALUES (?, ?)`)
      .run("user_x", "x@example.com");
    database.sqlite
      .prepare(
        `INSERT INTO applications (id, user_id, contact_email, contact_handle, interest_format, status, created_at, reviewed_at, intro_text, portfolio_url, message_to_hosts, admin_note, reviewed_by, updated_at) VALUES (?, NULL, ?, NULL, 'novel', 'pending', ?, NULL, NULL, NULL, NULL, NULL, NULL, ?)`,
      )
      .run(
        "app_unlinked",
        "x@example.com",
        "2026-04-12T00:00:00.000Z",
        "2026-04-12T00:00:00.000Z",
      );
    const application = await getPortalApplicationByUserId(
      database as unknown as D1Database,
      "user_x",
    );
    expect(application).toBeNull();
    const row = database.sqlite
      .prepare(`SELECT user_id FROM applications WHERE id = ?`)
      .get("app_unlinked") as {
      user_id: string | null;
    };
    expect(row.user_id).toBeNull();
  });
});
describe("createApplication conflicts", () => {
  it("raises a typed conflict when a user already has an application", async () => {
    const database = new SqliteD1Database();
    const { createApplication, DuplicateApplicationError } =
      await import("./applications");
    database.sqlite
      .prepare(
        `INSERT INTO applications (id, user_id, contact_email, contact_handle, interest_format, status, created_at, reviewed_at, intro_text, portfolio_url, message_to_hosts, admin_note, reviewed_by, updated_at) VALUES (?, ?, ?, NULL, 'novel', 'pending', ?, NULL, NULL, NULL, NULL, NULL, NULL, ?)`,
      )
      .run(
        "app_first",
        "user_dup",
        "dup@example.com",
        "2026-04-12T00:00:00.000Z",
        "2026-04-12T00:00:00.000Z",
      );
    await expect(
      createApplication(
        database as unknown as D1Database,
        {
          contactEmail: "dup@example.com",
          interestFormat: "novel",
        },
        { userId: "user_dup" },
      ),
    ).rejects.toBeInstanceOf(DuplicateApplicationError);
  });
});
