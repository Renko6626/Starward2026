import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { updateActiveScheduleSegment, updateParticipant } from "./admin";
type BatchResult = {
  success: boolean;
  meta: {
    changes: number;
    last_row_id: number;
  };
};
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
      meta: { changes: 0, last_row_id: 0 },
    };
  }
  async run(): Promise<BatchResult> {
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
  constructor() {
    this.sqlite.exec(`
      CREATE TABLE portal_profiles (user_id TEXT PRIMARY KEY, credit_name TEXT NOT NULL, bilibili_uid TEXT, is_anonymous INTEGER NOT NULL);
      CREATE TABLE schedule_versions (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE participants (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        application_id TEXT,
        invite_email TEXT,
        contact_handle TEXT,
        status TEXT NOT NULL,
        invited_at TEXT,
        activated_at TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE schedule_segments (
        scheduled_at TEXT,
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
        participant_id TEXT NOT NULL,
        segment_id TEXT,
        preview_status TEXT NOT NULL,
        review_status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }
  prepare(sql: string) {
    return new SqlitePreparedStatement(this.sqlite, sql);
  }
  async batch(statements: SqlitePreparedStatement[]) {
    this.sqlite.exec("BEGIN");
    try {
      const results: BatchResult[] = [];
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
}
const TS = "2026-04-12T00:00:00.000Z";
function seedSchedule(db: SqliteD1Database) {
  db.sqlite
    .prepare(
      `INSERT INTO schedule_versions (id, status, updated_at) VALUES (?, 'active', ?)`,
    )
    .run("sched_active", TS);
}
function seedParticipant(
  db: SqliteD1Database,
  id: string,
  status = "approved",
) {
  db.sqlite
    .prepare(
      `INSERT INTO participants (id, contact_handle, status, updated_at) VALUES (?, NULL, ?, ?)`,
    )
    .run(id, status, TS);
}
function seedProjectDraft(
  db: SqliteD1Database,
  id: string,
  participantId: string,
  segmentId: string,
) {
  db.sqlite
    .prepare(
      `INSERT INTO project_drafts (id, participant_id, segment_id, preview_status, review_status, created_at, updated_at) VALUES (?, ?, ?, 'draft', 'draft', ?, ?)`,
    )
    .run(id, participantId, segmentId, TS, TS);
}
function readParticipantStatus(db: SqliteD1Database, id: string) {
  return (
    db.sqlite
      .prepare(`SELECT status FROM participants WHERE id = ?`)
      .get(id) as {
      status: string;
    }
  ).status;
}
function seedSegment(
  db: SqliteD1Database,
  overrides: {
    id: string;
    status?: string;
    participantId?: string | null;
    sort?: number;
  },
) {
  db.sqlite
    .prepare(
      `INSERT INTO schedule_segments (
        id, schedule_version_id, code, name, description, status,
        current_participant_id, claimed_at, released_at, sort_order, created_at, updated_at
      ) VALUES (?, 'sched_active', ?, ?, NULL, ?, ?, NULL, NULL, ?, ?, ?)`,
    )
    .run(
      overrides.id,
      `CODE-${overrides.id}`,
      `name-${overrides.id}`,
      overrides.status ?? "open",
      overrides.participantId ?? null,
      overrides.sort ?? 1,
      TS,
      TS,
    );
}
function readSegment(db: SqliteD1Database, id: string) {
  return db.sqlite
    .prepare(
      `SELECT status, current_participant_id FROM schedule_segments WHERE id = ?`,
    )
    .get(id) as {
    status: string;
    current_participant_id: string | null;
  };
}
describe("updateActiveScheduleSegment", () => {
  it("assigns an approved participant to an open segment", async () => {
    const db = new SqliteD1Database();
    seedSchedule(db);
    seedParticipant(db, "part_a");
    seedSegment(db, { id: "seg_open", status: "open" });
    const result = await updateActiveScheduleSegment(
      db as unknown as D1Database,
      "seg_open",
      { status: "held", currentParticipantId: "part_a", description: null },
      "admin@example.com",
    );
    expect(result.ok).toBe(true);
    const segment = readSegment(db, "seg_open");
    expect(segment.status).toBe("held");
    expect(segment.current_participant_id).toBe("part_a");
  });
  it("releases the participant's previously held segment when reassigning them", async () => {
    const db = new SqliteD1Database();
    seedSchedule(db);
    seedParticipant(db, "part_a");
    seedSegment(db, {
      id: "seg_held",
      status: "held",
      participantId: "part_a",
      sort: 1,
    });
    seedSegment(db, { id: "seg_target", status: "open", sort: 2 });
    const result = await updateActiveScheduleSegment(
      db as unknown as D1Database,
      "seg_target",
      { status: "held", currentParticipantId: "part_a", description: null },
      "admin@example.com",
    );
    expect(result.ok).toBe(true);
    expect(readSegment(db, "seg_target")).toMatchObject({
      status: "held",
      current_participant_id: "part_a",
    });
    expect(readSegment(db, "seg_held")).toMatchObject({
      status: "released",
      current_participant_id: null,
    });
  });
});
describe("updateParticipant", () => {
  it("releases the held segment when an approved participant is downgraded to withdrawn", async () => {
    const db = new SqliteD1Database();
    seedSchedule(db);
    seedParticipant(db, "part_a", "approved");
    seedSegment(db, {
      id: "seg_held",
      status: "held",
      participantId: "part_a",
    });
    seedProjectDraft(db, "draft_a", "part_a", "seg_held");
    const result = await updateParticipant(
      db as unknown as D1Database,
      "part_a",
      { status: "withdrawn" },
      "admin@example.com",
    );
    expect(result).not.toBeNull();
    expect(readParticipantStatus(db, "part_a")).toBe("withdrawn");
    expect(readSegment(db, "seg_held")).toMatchObject({
      status: "released",
      current_participant_id: null,
    });
  });
});
