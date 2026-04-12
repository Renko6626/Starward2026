import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { EventWindowSummary } from "../../src/shared/windows";
import type { ParticipantAuthRow } from "./participants";
import {
  changeParticipantSegment,
  claimParticipantSegment,
  releaseParticipantSegment,
} from "./segments";

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
      meta: {
        changes: 0,
        last_row_id: 0,
      },
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
      CREATE TABLE schedule_versions (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL
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

const baseWindow: EventWindowSummary = {
  key: "application_open",
  label: "报名开放",
  isEnabled: false,
  isOpen: false,
  opensAt: null,
  closesAt: null,
  updatedAt: "2026-04-12T00:00:00.000Z",
};

function buildWindows(openKeys: EventWindowSummary["key"][]) {
  const keys: EventWindowSummary["key"][] = [
    "application_open",
    "segment_claim_open",
    "segment_change_open",
    "preview_submit_open",
    "review_submit_open",
    "public_release_open",
  ];

  return keys.map((key) => ({
    ...baseWindow,
    key,
    label: key,
    isEnabled: openKeys.includes(key),
    isOpen: openKeys.includes(key),
  }));
}

function buildParticipant(overrides: Partial<ParticipantAuthRow> = {}): ParticipantAuthRow {
  return {
    id: "part_smoke",
    user_id: "user_smoke",
    invite_email: "smoke@example.com",
    display_name: "烟测样本",
    contact_handle: "@smoke",
    status: "invited",
    activated_at: null,
    updated_at: "2026-04-12T00:00:00.000Z",
    current_segment_code: null,
    current_segment_name: null,
    ...overrides,
  };
}

function seedBaseSchedule(database: SqliteD1Database) {
  database.sqlite
    .prepare(`INSERT INTO schedule_versions (id, status, updated_at) VALUES (?, 'active', ?)`)
    .run("sched_active", "2026-04-12T00:00:00.000Z");

  database.sqlite
    .prepare(
      `INSERT INTO project_drafts (
        id,
        participant_id,
        segment_id,
        preview_status,
        review_status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, 'not_started', 'not_started', ?, ?)`,
    )
    .run(
      "draft_smoke",
      "part_smoke",
      null,
      "2026-04-12T00:00:00.000Z",
      "2026-04-12T00:00:00.000Z",
    );
}

describe("segment mutations on SQLite-compatible SQL", () => {
  it("claims an open segment and updates project draft linkage", async () => {
    const database = new SqliteD1Database();
    seedBaseSchedule(database);
    database.sqlite
      .prepare(
        `INSERT INTO schedule_segments (
          id,
          schedule_version_id,
          code,
          name,
          description,
          status,
          current_participant_id,
          claimed_at,
          released_at,
          sort_order,
          created_at,
          updated_at
        ) VALUES (?, 'sched_active', 'SEED-101', '样本时间段 A', 'claim smoke', 'open', NULL, NULL, NULL, 101, ?, ?)`,
      )
      .run("seg_open_a", "2026-04-12T00:00:00.000Z", "2026-04-12T00:00:00.000Z");

    const result = await claimParticipantSegment(database as unknown as D1Database, {
      participant: buildParticipant(),
      windows: buildWindows(["segment_claim_open"]),
      segmentId: "seg_open_a",
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.response.segment?.code).toBe("SEED-101");

    const claimedSegment = database.sqlite
      .prepare(`SELECT status, current_participant_id FROM schedule_segments WHERE id = ?`)
      .get("seg_open_a") as { status: string; current_participant_id: string };
    const draft = database.sqlite
      .prepare(`SELECT segment_id FROM project_drafts WHERE participant_id = ?`)
      .get("part_smoke") as { segment_id: string | null };
    const event = database.sqlite
      .prepare(`SELECT event_type, target_id FROM participant_events WHERE participant_id = ?`)
      .get("part_smoke") as { event_type: string; target_id: string };

    expect(claimedSegment).toEqual({
      status: "held",
      current_participant_id: "part_smoke",
    });
    expect(draft.segment_id).toBe("seg_open_a");
    expect(event).toEqual({
      event_type: "segment_claimed",
      target_id: "seg_open_a",
    });
  });

  it("changes from the current segment to another open segment", async () => {
    const database = new SqliteD1Database();
    seedBaseSchedule(database);
    database.sqlite
      .prepare(`UPDATE project_drafts SET segment_id = ? WHERE participant_id = ?`)
      .run("seg_held_a", "part_smoke");
    database.sqlite
      .prepare(
        `INSERT INTO schedule_segments (
          id,
          schedule_version_id,
          code,
          name,
          description,
          status,
          current_participant_id,
          claimed_at,
          released_at,
          sort_order,
          created_at,
          updated_at
        ) VALUES
        ('seg_held_a', 'sched_active', 'SEED-101', '样本时间段 A', 'held', 'held', 'part_smoke', '2026-04-12T00:10:00.000Z', NULL, 101, '2026-04-12T00:00:00.000Z', '2026-04-12T00:10:00.000Z'),
        ('seg_open_b', 'sched_active', 'SEED-102', '样本时间段 B', 'open', 'open', NULL, NULL, NULL, 102, '2026-04-12T00:00:00.000Z', '2026-04-12T00:00:00.000Z')`,
      )
      .run();

    const result = await changeParticipantSegment(database as unknown as D1Database, {
      participant: buildParticipant({
        current_segment_code: "SEED-101",
        current_segment_name: "样本时间段 A",
      }),
      windows: buildWindows(["segment_change_open"]),
      segmentId: "seg_open_b",
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.response.segment?.code).toBe("SEED-102");

    const released = database.sqlite
      .prepare(`SELECT status, current_participant_id FROM schedule_segments WHERE id = ?`)
      .get("seg_held_a") as { status: string; current_participant_id: string | null };
    const claimed = database.sqlite
      .prepare(`SELECT status, current_participant_id FROM schedule_segments WHERE id = ?`)
      .get("seg_open_b") as { status: string; current_participant_id: string | null };
    const draft = database.sqlite
      .prepare(`SELECT segment_id FROM project_drafts WHERE participant_id = ?`)
      .get("part_smoke") as { segment_id: string | null };
    const event = database.sqlite
      .prepare(`SELECT event_type, target_id FROM participant_events WHERE participant_id = ?`)
      .get("part_smoke") as { event_type: string; target_id: string };

    expect(released).toEqual({
      status: "released",
      current_participant_id: null,
    });
    expect(claimed).toEqual({
      status: "held",
      current_participant_id: "part_smoke",
    });
    expect(draft.segment_id).toBe("seg_open_b");
    expect(event).toEqual({
      event_type: "segment_changed",
      target_id: "seg_open_b",
    });
  });

  it("releases the current segment and clears draft linkage", async () => {
    const database = new SqliteD1Database();
    seedBaseSchedule(database);
    database.sqlite
      .prepare(`UPDATE project_drafts SET segment_id = ? WHERE participant_id = ?`)
      .run("seg_held_a", "part_smoke");
    database.sqlite
      .prepare(
        `INSERT INTO schedule_segments (
          id,
          schedule_version_id,
          code,
          name,
          description,
          status,
          current_participant_id,
          claimed_at,
          released_at,
          sort_order,
          created_at,
          updated_at
        ) VALUES (?, 'sched_active', 'SEED-101', '样本时间段 A', 'held', 'held', 'part_smoke', '2026-04-12T00:10:00.000Z', NULL, 101, '2026-04-12T00:00:00.000Z', '2026-04-12T00:10:00.000Z')`,
      )
      .run("seg_held_a");

    const result = await releaseParticipantSegment(database as unknown as D1Database, {
      participant: buildParticipant({
        current_segment_code: "SEED-101",
        current_segment_name: "样本时间段 A",
      }),
      windows: buildWindows(["segment_change_open"]),
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.response.segment).toBeNull();

    const released = database.sqlite
      .prepare(`SELECT status, current_participant_id FROM schedule_segments WHERE id = ?`)
      .get("seg_held_a") as { status: string; current_participant_id: string | null };
    const draft = database.sqlite
      .prepare(`SELECT segment_id FROM project_drafts WHERE participant_id = ?`)
      .get("part_smoke") as { segment_id: string | null };
    const event = database.sqlite
      .prepare(`SELECT event_type, target_id FROM participant_events WHERE participant_id = ?`)
      .get("part_smoke") as { event_type: string; target_id: string };

    expect(released).toEqual({
      status: "released",
      current_participant_id: null,
    });
    expect(draft.segment_id).toBeNull();
    expect(event).toEqual({
      event_type: "segment_released",
      target_id: "seg_held_a",
    });
  });
});
