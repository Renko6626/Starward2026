import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildLocalSeedSql } from "../../scripts/lib/local-dev-bootstrap.mjs";
import { getPublicWork, listPublicWorks, setWorkPublication } from "./works";
import { updateAdminProjectDraftReview, updatePortalProjectPreview } from "./project-drafts";
import { getParticipantByUserId } from "./participants";
import { updateActiveScheduleSegment } from "./admin";
import { publicApi } from "../routes/public";
import { adminApi } from "../routes/admin";
import { Hono } from "hono";
import type { AppRouteConfig } from "../lib/types";
import { workPublicationFieldsSchema } from "../../src/shared/works";

class Statement {
  constructor(private db: DatabaseSync, private sql: string, private args: SQLInputValue[] = []) {}
  bind(...args: SQLInputValue[]) { return new Statement(this.db, this.sql, args); }
  async first<T>() { return (this.db.prepare(this.sql).get(...this.args) as T | undefined) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async run() { const result = this.db.prepare(this.sql).run(...this.args); return { success: true, meta: { changes: Number(result.changes) } }; }
}
class TestDatabase {
  sqlite = new DatabaseSync(":memory:");
  prepare(sql: string) { return new Statement(this.sqlite, sql); }
  async batch(statements: Statement[]) {
    this.sqlite.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) { this.sqlite.exec("ROLLBACK"); throw error; }
  }
}
let database: TestDatabase;
let db: D1Database;
const draftId = "draft_seed_active";
const actor = "admin@example.com";
function openWindow() {
  database.sqlite.exec("UPDATE event_windows SET is_enabled = 1, opens_at = NULL, closes_at = NULL WHERE key = 'public_release_open'");
}
function readyDraft() {
  database.sqlite.exec(`UPDATE project_drafts SET preview_status = 'approved', review_status = 'approved',
    work_type = 'text', work_url = 'https://example.com/story' WHERE id = '${draftId}'`);
}

beforeEach(() => {
  database = new TestDatabase(); db = database as unknown as D1Database;
  for (const file of readdirSync("migrations").filter(file => file.endsWith(".sql")).sort()) database.sqlite.exec(readFileSync(`migrations/${file}`, "utf8"));
  database.sqlite.exec(buildLocalSeedSql());
});
afterEach(() => database.sqlite.close());

describe("public work publication", () => {
  it("preserves existing drafts and requires an open release window, approvals and public metadata", async () => {
    expect(await listPublicWorks(db)).toEqual([]);
    expect(await getPublicWork(db, draftId)).toBeNull();
    expect(await setWorkPublication(db, draftId, true, actor)).toMatchObject({ ok: false, code: "release_closed" });
    openWindow();
    expect(await setWorkPublication(db, draftId, true, actor)).toMatchObject({ ok: false, code: "work_incomplete" });
    readyDraft();
    expect(await setWorkPublication(db, draftId, true, actor)).toMatchObject({ ok: true });
    expect(await listPublicWorks(db)).toHaveLength(1);
  });

  it("keeps the archive visible after the window closes and permits withdrawal at any time", async () => {
    openWindow(); readyDraft();
    await setWorkPublication(db, draftId, true, actor);
    database.sqlite.exec("UPDATE event_windows SET is_enabled = 0 WHERE key = 'public_release_open'");
    expect(await getPublicWork(db, draftId)).not.toBeNull();
    expect(await setWorkPublication(db, draftId, false, actor)).toMatchObject({ ok: true });
    expect(await getPublicWork(db, draftId)).toBeNull();
    expect(await listPublicWorks(db)).toEqual([]);
    const events = database.sqlite.prepare("SELECT event_type FROM participant_events WHERE event_type LIKE 'work_%' ORDER BY rowid").all();
    expect(events.map(event => event.event_type)).toEqual(["work_published", "work_unpublished"]);
  });

  it("requires withdrawal before review changes and allows editing after changes are requested", async () => {
    openWindow(); readyDraft(); await setWorkPublication(db, draftId, true, actor);
    const change = { previewStatus: "changes_requested" as const, reviewStatus: "approved" as const };
    expect(await updateAdminProjectDraftReview(db, draftId, change, actor)).toMatchObject({ ok: false, code: "work_published" });
    const participant = (await getParticipantByUserId(db, "usr_seed_active"))!;
    expect(await updatePortalProjectPreview(db, { participant, data: { previewTitle: "changed" } })).toMatchObject({ ok: false, code: "preview_already_approved" });
    await setWorkPublication(db, draftId, false, actor);
    expect(await updateAdminProjectDraftReview(db, draftId, change, actor)).toMatchObject({ ok: true });
    const saved = await updatePortalProjectPreview(db, { participant, data: {
      previewTitle: "新的观测", previewSummary: "简介", workType: "illustration", workUrl: "https://example.com/new",
      coverUrl: "https://example.com/cover.webp", coverAlt: "夜空", formatLabel: "插画", publicTags: ["秘封"],
    } });
    expect(saved).toMatchObject({ ok: true, draft: { workType: "illustration", coverAlt: "夜空", workUrl: "https://example.com/new", publishedAt: null } });
    expect(await listPublicWorks(db)).toEqual([]);
  });

  it("uses anonymous public credit and never exposes contact or review details in list or direct responses", async () => {
    openWindow(); readyDraft();
    database.sqlite.exec("UPDATE portal_profiles SET is_anonymous = 1 WHERE user_id = 'usr_seed_active'");
    await setWorkPublication(db, draftId, true, actor);
    const app = new Hono<AppRouteConfig>().route("/api", publicApi);
    for (const path of ["/api/works", `/api/works/${draftId}`]) {
      const response = await app.request(`http://localhost${path}`, {}, { DB: db });
      expect(response.status).toBe(200);
      const body = await response.json() as any;
      const work = body.work ?? body.items[0];
      expect(work.publicAuthorName).toBe("匿名");
      expect(Object.keys(work).sort()).toEqual([
        "id", "previewTitle", "previewSummary", "publicAuthorName", "workType", "formatLabel", "publicTags",
        "coverUrl", "coverAlt", "workUrl", "publishedAt", "segmentCode", "segmentName", "observationNumber",
      ].sort());
    }
    await setWorkPublication(db, draftId, false, actor);
    expect((await app.request(`http://localhost/api/works/${draftId}`, {}, { DB: db })).status).toBe(404);
  });

  it("orders by relay slot, keeps unassigned work last and skips unpublished neighbors", async () => {
    openWindow(); readyDraft(); await setWorkPublication(db, draftId, true, actor);
    database.sqlite.exec(`INSERT INTO project_drafts (id,participant_id,segment_id,preview_title,preview_summary,work_type,work_url,preview_status,review_status,created_at,updated_at)
      VALUES ('draft_pending','part_seed_pending','seg_seed_101','另一份观测','简介','music','https://example.com/music','approved','approved','2026-09-30','2026-09-30')
      ON CONFLICT(participant_id) DO UPDATE SET id = excluded.id, segment_id = excluded.segment_id, preview_title = excluded.preview_title, preview_summary = excluded.preview_summary, work_type = excluded.work_type, work_url = excluded.work_url, preview_status = excluded.preview_status, review_status = excluded.review_status`);
    await setWorkPublication(db, "draft_pending", true, actor);
    expect((await listPublicWorks(db)).map(work => work.id)).toEqual(["draft_pending", draftId]);
    expect(await getPublicWork(db, draftId)).toMatchObject({ previous: { id: "draft_pending" }, next: null });
    database.sqlite.exec("UPDATE project_drafts SET segment_id = NULL WHERE id = 'draft_pending'");
    expect((await listPublicWorks(db)).map(work => work.id)).toEqual([draftId, "draft_pending"]);
    await setWorkPublication(db, "draft_pending", false, actor);
    expect(await getPublicWork(db, draftId)).toMatchObject({ previous: null, next: null });
  });

  it("requires admin access and supports publish/unpublish through the actual routes", async () => {
    openWindow(); readyDraft();
    const app = new Hono<AppRouteConfig>().route("/api/admin", adminApi);
    const url = `http://localhost/api/admin/project-drafts/${draftId}`;
    expect((await app.request(`${url}/publish`, { method: "POST" }, { DB: db, CLOUDFLARE_ACCESS_TEAM_DOMAIN: "https://example.cloudflareaccess.com", CLOUDFLARE_ACCESS_POLICY_AUD: "test" })).status).toBe(403);
    const env = { DB: db, ALLOW_LOCAL_ADMIN_BYPASS: "true" };
    for (const action of ["publish", "unpublish"]) {
      expect((await app.request(`${url}/${action}`, { method: "POST" }, env)).status).toBe(200);
    }
    const response = await app.request(url, {}, env);
    expect(await response.json()).toMatchObject({ publicationWindow: { isOpen: true }, draft: { publishedAt: null } });
  });
});

it("accepts empty draft URLs but rejects executable, invalid and credential-bearing public URLs", () => {
  for (const value of ["javascript:alert(1)", "data:text/html,hello", "not a URL", "http://example.com", "https://name:secret@example.com"]) {
    expect(workPublicationFieldsSchema.safeParse({ workUrl: value }).success).toBe(false);
    expect(workPublicationFieldsSchema.safeParse({ coverUrl: value }).success).toBe(false);
  }
  expect(workPublicationFieldsSchema.safeParse({ workUrl: "", coverUrl: "", workType: null }).success).toBe(true);
});


describe("public relay timetable", () => {
  it("keeps slots and approved anonymous previews without leaking draft links", async () => {
    database.sqlite.exec(`UPDATE portal_profiles SET is_anonymous = 1 WHERE user_id = 'usr_seed_active';
      UPDATE project_drafts SET preview_status = 'approved', work_url = 'https://example.com/private' WHERE id = 'draft_seed_active';
      UPDATE schedule_segments SET scheduled_at = '2099-01-01T00:00:00.000Z' WHERE current_participant_id = 'part_seed_active'`);
    const app = new Hono<AppRouteConfig>().route("/api", publicApi);
    const response = await app.request("http://localhost/api/works", {}, { DB: db });
    const body = await response.json() as any;
    const slot = body.schedule.find((entry: any) => entry.preview);
    expect(body.items).toEqual([]);
    expect(slot).toMatchObject({ publicAuthorName: "匿名", scheduledAt: "2099-01-01T00:00:00.000Z", workId: null });
    expect(slot.preview.previewTitle).toBeTruthy();
    expect(body.schedule.some((entry: any) => entry.preview === null)).toBe(true);
    expect(JSON.stringify(body)).not.toContain("https://example.com/private");
    expect(Object.keys(slot).sort()).toEqual(["id", "code", "name", "scheduledAt", "status", "publicAuthorName", "preview", "workId"].sort());
    database.sqlite.exec("UPDATE project_drafts SET preview_status = 'submitted' WHERE id = 'draft_seed_active'");
    const pending = await (await app.request("http://localhost/api/works", {}, { DB: db })).json() as any;
    expect(pending.schedule.every((entry: any) => entry.preview === null)).toBe(true);
  });

  it("distinguishes open, reserved, confirmed and closed slots without publishing pending identities", async () => {
    database.sqlite.exec(`UPDATE schedule_segments SET status = 'held', current_participant_id = 'part_seed_pending' WHERE id = 'seg_seed_101';
      UPDATE schedule_segments SET status = 'completed' WHERE id = 'seg_seed_102';
      UPDATE portal_profiles SET credit_name = '待审核私有署名' WHERE user_id = 'usr_seed_pending'`);
    const app = new Hono<AppRouteConfig>().route("/api", publicApi);
    const body = await (await app.request("http://localhost/api/works", {}, { DB: db })).json() as any;
    expect(body.schedule.find((entry: any) => entry.id === 'seg_seed_101')).toMatchObject({ status: "reserved", publicAuthorName: null, preview: null });
    expect(body.schedule.find((entry: any) => entry.id === 'seg_seed_102')).toMatchObject({ status: "confirmed", publicAuthorName: "结界观测者" });
    expect(body.schedule.find((entry: any) => entry.id === 'seg_seed_103')).toMatchObject({ status: "unavailable" });
    expect(JSON.stringify(body)).not.toContain('待审核私有署名');
    expect(JSON.stringify(body)).not.toContain('part_seed_pending');
    database.sqlite.exec("UPDATE schedule_segments SET status = 'released', current_participant_id = NULL WHERE id = 'seg_seed_101'");
    const released = await (await app.request("http://localhost/api/works", {}, { DB: db })).json() as any;
    expect(released.schedule.find((entry: any) => entry.id === 'seg_seed_101')).toMatchObject({ status: "available", publicAuthorName: null, preview: null });
  });

  it("gates published details until the last instant and retains chronological slots afterwards", async () => {
    openWindow(); readyDraft(); await setWorkPublication(db, draftId, true, actor);
    database.sqlite.exec(`UPDATE schedule_segments SET scheduled_at = '2000-01-01T00:00:00.000Z';
      UPDATE schedule_segments SET scheduled_at = '2099-01-01T00:00:00.000Z' WHERE current_participant_id = 'part_seed_active'`);
    const app = new Hono<AppRouteConfig>().route("/api", publicApi);
    expect(await listPublicWorks(db)).toEqual([]);
    expect((await app.request(`http://localhost/api/works/${draftId}`, {}, { DB: db })).status).toBe(404);
    database.sqlite.exec("UPDATE schedule_segments SET scheduled_at = NULL WHERE current_participant_id = 'part_seed_active'");
    expect(await getPublicWork(db, draftId)).toBeNull();
    database.sqlite.exec("UPDATE schedule_segments SET scheduled_at = '1999-12-31T23:00:00.000Z' WHERE current_participant_id = 'part_seed_active'");
    const body = await (await app.request("http://localhost/api/works", {}, { DB: db })).json() as any;
    expect(body.schedule[0]).toMatchObject({ scheduledAt: "1999-12-31T23:00:00.000Z", workId: draftId });
    expect((await app.request(`http://localhost/api/works/${draftId}`, {}, { DB: db })).status).toBe(200);
    await setWorkPublication(db, draftId, false, actor);
    const withdrawn = await (await app.request("http://localhost/api/works", {}, { DB: db })).json() as any;
    expect(withdrawn.schedule[0].workId).toBeNull();
    expect(withdrawn.schedule[0].preview).not.toBeNull();
  });

  it("saves, preserves and clears the admin publication instant", async () => {
    const slot = database.sqlite.prepare("SELECT id FROM schedule_segments WHERE current_participant_id = 'part_seed_active'").get() as { id: string };
    const input = { status: "held" as const, currentParticipantId: "part_seed_active" };
    expect(await updateActiveScheduleSegment(db, slot.id, { ...input, scheduledAt: "2026-12-01T10:00:00+08:00" }, actor))
      .toMatchObject({ ok: true, item: { scheduledAt: "2026-12-01T02:00:00.000Z" } });
    expect(await updateActiveScheduleSegment(db, slot.id, { ...input, description: "说明" }, actor))
      .toMatchObject({ ok: true, item: { scheduledAt: "2026-12-01T02:00:00.000Z" } });
    expect(await updateActiveScheduleSegment(db, slot.id, { ...input, scheduledAt: null }, actor))
      .toMatchObject({ ok: true, item: { scheduledAt: null } });
  });
});
