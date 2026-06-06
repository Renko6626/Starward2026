import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { ParticipantAuthRow } from "./participants";

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
    return { results: rows as T[], success: true, meta: { changes: 0, last_row_id: 0 } };
  }

  async run() {
    const result = this.database.prepare(this.sql).run(...this.params);
    return {
      success: true,
      meta: { changes: Number(result.changes ?? 0), last_row_id: Number(result.lastInsertRowid ?? 0) },
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

      CREATE TABLE participants (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        invite_email TEXT NOT NULL,
        contact_handle TEXT,
        status TEXT NOT NULL
      );

      CREATE TABLE schedule_segments (
        id TEXT PRIMARY KEY,
        schedule_version_id TEXT NOT NULL,
        code TEXT,
        name TEXT,
        status TEXT NOT NULL,
        current_participant_id TEXT,
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
        preview_title TEXT,
        preview_summary TEXT,
        public_author_name TEXT,
        format_label TEXT,
        public_tags_json TEXT,
        content_note TEXT,
        content_warnings TEXT,
        review_note TEXT,
        preview_status TEXT NOT NULL,
        review_status TEXT NOT NULL,
        preview_submitted_at TEXT,
        review_submitted_at TEXT,
        reviewed_at TEXT,
        reviewed_by TEXT,
        admin_feedback TEXT,
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
}

const PARTICIPANT: ParticipantAuthRow = {
  id: "part_x",
  user_id: "user_x",
  invite_email: "x@example.com",
  display_name: "创作者",
  contact_handle: null,
  status: "approved",
  activated_at: null,
  updated_at: "2026-04-12T00:00:00.000Z",
  current_segment_code: null,
  current_segment_name: null,
};

function seedApprovedDraft(
  db: SqliteD1Database,
  fields: { preview_status?: string; review_status?: string } = {},
) {
  db.sqlite
    .prepare(`INSERT INTO participants (id, display_name, invite_email, contact_handle, status) VALUES (?, ?, ?, ?, ?)`)
    .run("part_x", "创作者", "x@example.com", null, "approved");

  db.sqlite
    .prepare(
      `INSERT INTO project_drafts (
        id, participant_id, segment_id, preview_title, preview_summary, public_author_name,
        format_label, public_tags_json, content_note, content_warnings, review_note,
        preview_status, review_status, preview_submitted_at, review_submitted_at,
        reviewed_at, reviewed_by, admin_feedback, created_at, updated_at
      ) VALUES (?, ?, NULL, ?, ?, ?, ?, NULL, ?, ?, NULL, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, ?)`,
    )
    .run(
      "draft_x",
      "part_x",
      "原标题",
      "原简介",
      "作者名",
      "小说",
      "原概述",
      "原警示",
      fields.preview_status ?? "approved",
      fields.review_status ?? "approved",
      "2026-04-12T00:00:00.000Z",
      "2026-04-12T00:00:00.000Z",
    );
}

describe("updatePortalProjectPreview save guard", () => {
  it("refuses to un-approve an admin-approved preview when the participant saves edits", async () => {
    const db = new SqliteD1Database();
    const { updatePortalProjectPreview } = await import("./project-drafts");
    seedApprovedDraft(db, { preview_status: "approved", review_status: "draft" });

    const result = await updatePortalProjectPreview(db as unknown as D1Database, {
      participant: PARTICIPANT,
      data: { previewTitle: "改过的标题", previewSummary: "改过的简介", publicAuthorName: "作者名", formatLabel: "小说" },
    });

    expect(result.ok).toBe(false);
    const row = db.sqlite
      .prepare(`SELECT preview_status, preview_title FROM project_drafts WHERE id = ?`)
      .get("draft_x") as { preview_status: string; preview_title: string };
    expect(row.preview_status).toBe("approved");
    expect(row.preview_title).toBe("原标题");
  });
});

describe("updatePortalProjectReview save guard", () => {
  it("refuses to un-approve an admin-approved review when the participant saves edits", async () => {
    const db = new SqliteD1Database();
    const { updatePortalProjectReview } = await import("./project-drafts");
    seedApprovedDraft(db, { preview_status: "draft", review_status: "approved" });

    const result = await updatePortalProjectReview(db as unknown as D1Database, {
      participant: PARTICIPANT,
      data: { contentNote: "改过的概述", contentWarnings: "改过的警示" },
    });

    expect(result.ok).toBe(false);
    const row = db.sqlite
      .prepare(`SELECT review_status, content_note FROM project_drafts WHERE id = ?`)
      .get("draft_x") as { review_status: string; content_note: string };
    expect(row.review_status).toBe("approved");
    expect(row.content_note).toBe("原概述");
  });
});
