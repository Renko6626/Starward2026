import { saveWorkPresentation } from './work-presentations';
import { createWorkSubmission, createWorkSubmissionReview } from './work-submissions';
import { adminTestSession } from '../test/admin-session';
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildLocalSeedSql } from "../../scripts/lib/local-dev-bootstrap.mjs";
import { getPublicWork, listPublicWorks, setWorkPublication } from "./works";
import { getParticipantByUserId } from "./participants";
import { appendActiveScheduleSegments, updateActiveScheduleSegment } from "./admin";
import { claimParticipantSegment, getCurrentSegmentForParticipant, listAvailableSegments } from './segments';
import { listEventWindows } from './event-windows';
import { publicApi } from "../routes/public";
import { adminApi } from "../routes/admin";
import { Hono } from "hono";
import type { AppRouteConfig } from "../lib/types";
import { workPublicationFieldsSchema } from "../../src/shared/works";

class Statement {
  constructor(private db: DatabaseSync, private sql: string, private args: SQLInputValue[] = []) {}
  bind(...args: SQLInputValue[]) { return new Statement(this.db, this.sql, args); }
  async first<T>() { return (this.db.prepare(this.sql).get(...this.args) as T | undefined) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args), success: true, meta: this.db.prepare('SELECT changes() AS changes, last_insert_rowid() AS last_row_id').get() }; }
  async run() { const result = this.db.prepare(this.sql).run(...this.args); return { success: true, meta: { changes: Number(result.changes) } }; }
}
class TestDatabase {
  sqlite = new DatabaseSync(":memory:");
  async exec(sql: string) { this.sqlite.exec(sql); }
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
function contentApproval(id = draftId) {
  database.sqlite.prepare(`INSERT INTO work_submissions (id,draft_id,version_number,title,work_type,summary,submitted_at)
    SELECT 'version_'||id,id,1,COALESCE(preview_title,'作品'),'text',COALESCE(preview_summary,'简介'),'2026-10-31' FROM project_drafts WHERE id=?`).run(id);
  database.sqlite.prepare("INSERT INTO work_submission_reviews (submission_id,decision,reviewed_by,created_at) VALUES (?,'approved','host','2026-10-31')").run('version_'+id);
}
async function readyDraft() {
  contentApproval();
  database.sqlite.exec(`UPDATE project_drafts SET preview_status = 'approved', review_status = 'approved',
    work_type = 'text', work_url = 'https://example.com/story' WHERE id = '${draftId}'`);
  await saveWorkPresentation(db,'seg_seed_102',{title:'结界观测预告',summary:'展示简介',workType:'text',thumbnailId:null,thumbnailAlt:'',sourceUrl:'https://example.com/story',content:{kind:'markdown',markdown:'正式公开正文'}});
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
    expect(await getPublicWork(db, '02')).toBeNull();
    expect(await setWorkPublication(db, draftId, true, actor)).toMatchObject({ ok: false, code: "release_closed" });
    openWindow();
    expect(await setWorkPublication(db, draftId, true, actor)).toMatchObject({ ok: false, code: "work_incomplete" });
    await readyDraft();
    expect(await setWorkPublication(db, draftId, true, actor)).toMatchObject({ ok: true });
    expect(await listPublicWorks(db)).toHaveLength(1);
  });

  it("keeps the archive visible after the window closes and permits withdrawal at any time", async () => {
    openWindow(); await readyDraft();
    await setWorkPublication(db, draftId, true, actor);
    database.sqlite.exec("UPDATE event_windows SET is_enabled = 0 WHERE key = 'public_release_open'");
    expect(await getPublicWork(db, '02')).not.toBeNull();
    expect(await setWorkPublication(db, draftId, false, actor)).toMatchObject({ ok: true });
    expect(await getPublicWork(db, '02')).toBeNull();
    expect(await listPublicWorks(db)).toEqual([]);
    const events = database.sqlite.prepare("SELECT event_type FROM participant_events WHERE event_type LIKE 'work_%' ORDER BY rowid").all();
    expect(events.map(event => event.event_type)).toEqual(["work_published", "work_unpublished"]);
  });

  it("keeps unreviewed revisions private and requires withdrawal before a negative review", async () => {
    openWindow(); await readyDraft(); await setWorkPublication(db,draftId,true,actor);
    database.sqlite.exec("UPDATE event_windows SET is_enabled=1,opens_at=NULL WHERE key='work_upload_open'");
    database.sqlite.exec("INSERT INTO work_files (id,draft_id,object_key,upload_id,filename,size,content_type,created_at,completed_at) VALUES ('revision-file','draft_seed_active','object','upload','secret.txt',3,'text/plain','2026-10-31','2026-10-31')");
    const submitted = await createWorkSubmission(db,'part_seed_active',{title:'未复审标题',summary:'私有简介',workType:'text',fileIds:['revision-file'],versionNote:'仅主催可见'});
    expect(submitted.ok).toBe(true); if (!submitted.ok) throw new Error(submitted.message);
    const version = submitted.workspace.latest!;
    expect(await getPublicWork(db,'02')).toMatchObject({work:{previewTitle:'结界观测预告'}});
    expect(JSON.stringify(await getPublicWork(db,'02'))).not.toContain('secret.txt');
    expect(JSON.stringify(await getPublicWork(db,'02'))).not.toContain('私有简介');
    expect(await createWorkSubmissionReview(db,draftId,version.id,{decision:'changes_requested',feedback:'修改正文'},actor)).toMatchObject({ok:false,code:'work_published'});
    await setWorkPublication(db,draftId,false,actor);
    expect(await createWorkSubmissionReview(db,draftId,version.id,{decision:'changes_requested',feedback:'修改正文'},actor)).toMatchObject({ok:true});
    expect(await listPublicWorks(db)).toEqual([]);
  });

  it("shows author names in showcase mode without exposing contact or review details", async () => {
    openWindow(); await readyDraft();
    database.sqlite.exec("UPDATE portal_profiles SET is_anonymous = 1 WHERE user_id = 'usr_seed_active'");
    await setWorkPublication(db, draftId, true, actor);
    const app = new Hono<AppRouteConfig>().route("/api", publicApi);
    for (const path of ["/api/works", `/api/works/02`]) {
      const response = await app.request(`http://localhost${path}`, {}, { DB: db });
      expect(response.status).toBe(200);
      const body = await response.json() as any;
      const work = body.work ?? body.items[0];
      expect(work.publicAuthorName).toBe("结界观测者");
      expect(Object.keys(work).sort()).toEqual([
        "id", "previewTitle", "previewSummary", "publicAuthorName", "workType", "formatLabel", "publicTags",
        "coverUrl", "coverAlt", "workUrl", "publishedAt", "segmentCode", "segmentName", "observationNumber", "content",
      ].sort());
    }
    await setWorkPublication(db, draftId, false, actor);
    expect((await app.request(`http://localhost/api/works/02`, {}, { DB: db })).status).toBe(404);
  });

  it("orders by relay slot, keeps untimed slots last and skips unpublished neighbors", async () => {
    openWindow(); await readyDraft(); await setWorkPublication(db, draftId, true, actor);
    database.sqlite.exec(`INSERT INTO project_drafts (id,participant_id,segment_id,preview_title,preview_summary,work_type,work_url,preview_status,review_status,created_at,updated_at)
      VALUES ('draft_pending','part_seed_pending','seg_seed_101','另一份观测','简介','music','https://example.com/music','approved','approved','2026-09-30','2026-09-30')
      ON CONFLICT(participant_id) DO UPDATE SET id = excluded.id, segment_id = excluded.segment_id, preview_title = excluded.preview_title, preview_summary = excluded.preview_summary, work_type = excluded.work_type, work_url = excluded.work_url, preview_status = excluded.preview_status, review_status = excluded.review_status`);
    database.sqlite.exec("UPDATE participants SET status='approved' WHERE id='part_seed_pending'; UPDATE schedule_segments SET status='held',current_participant_id='part_seed_pending' WHERE id='seg_seed_101'");
    contentApproval("draft_pending");
    await saveWorkPresentation(db,'seg_seed_101',{title:'另一份观测',summary:'简介',workType:'music',thumbnailId:null,thumbnailAlt:'',sourceUrl:'https://example.com/music',content:{kind:'markdown',markdown:'另一份正文'}});
    await setWorkPublication(db, "draft_pending", true, actor);
    expect((await listPublicWorks(db)).map(work => work.id)).toEqual(["draft_pending", draftId]);
    expect(await getPublicWork(db, '02')).toMatchObject({ previous: { id: "draft_pending" }, next: null });
    database.sqlite.exec("UPDATE schedule_segments SET scheduled_at = NULL WHERE id = 'seg_seed_101'");
    expect((await listPublicWorks(db)).map(work => work.id)).toEqual([draftId, "draft_pending"]);
    await setWorkPublication(db, "draft_pending", false, actor);
    expect(await getPublicWork(db, '02')).toMatchObject({ previous: null, next: null });
  });

  it("requires admin access and supports publish/unpublish through the actual routes", async () => {
    openWindow(); await readyDraft();
    const app = new Hono<AppRouteConfig>().route("/api/admin", adminApi);
    const url = `http://localhost/api/admin/project-drafts/${draftId}`;
    const { env, headers } = await adminTestSession(db);
    expect((await app.request(`${url}/publish`, { method: "POST" }, env)).status).toBe(401);
    for (const action of ["publish", "unpublish"]) {
      expect((await app.request(`${url}/${action}`, { method: "POST", headers }, env)).status).toBe(200);
    }
    const response = await app.request(url, { headers }, env);
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
  it("shows approved intentions before previews and updates them without exposing pending intentions", async () => {
    database.sqlite.exec(`UPDATE applications SET interest_format = 'cosplay', intro_text = '制作秘封主题的角色服装与摄影作品。' WHERE user_id = 'usr_seed_active';
      UPDATE applications SET interest_format = 'music', intro_text = '待审核的私有创作意向' WHERE user_id = 'usr_seed_pending';
      UPDATE project_drafts SET preview_status = 'draft' WHERE id = 'draft_seed_active';
      UPDATE schedule_segments SET status = 'held', current_participant_id = 'part_seed_pending' WHERE id = 'seg_seed_101'`);
    const app = new Hono<AppRouteConfig>().route("/api", publicApi);
    const read = async () => (await (await app.request("http://localhost/api/works", {}, { DB: db })).json()) as any;
    const body = await read();
    expect(body.schedule.find((entry: any) => entry.id === 'seg_seed_102'))
      .toMatchObject({ status: 'confirmed', interestFormat: 'cosplay', introText: '制作秘封主题的角色服装与摄影作品。', preview: null });
    expect(body.schedule.find((entry: any) => entry.id === 'seg_seed_101'))
      .toMatchObject({ status: 'reserved', interestFormat: null, introText: null });
    expect(JSON.stringify(body)).not.toContain('待审核的私有创作意向');
    database.sqlite.exec("UPDATE applications SET interest_format = 'novel', intro_text = '创作月面旅行的短篇小说。' WHERE user_id = 'usr_seed_active'");
    expect((await read()).schedule.find((entry: any) => entry.id === 'seg_seed_102'))
      .toMatchObject({ interestFormat: 'novel', introText: '创作月面旅行的短篇小说。' });
  });

  it("keeps named schedule previews without leaking draft links", async () => {
    database.sqlite.exec(`UPDATE portal_profiles SET is_anonymous = 1 WHERE user_id = 'usr_seed_active';
      UPDATE project_drafts SET preview_status = 'approved', work_url = 'https://example.com/private' WHERE id = 'draft_seed_active';
      UPDATE schedule_segments SET scheduled_at = '2099-01-01T00:00:00.000Z' WHERE current_participant_id = 'part_seed_active'`);
    await saveWorkPresentation(db,'seg_seed_102',{title:'管理员展示标题',summary:'展示简介',workType:'text',thumbnailId:null,thumbnailAlt:'',sourceUrl:'https://example.com/private',content:{kind:'markdown',markdown:'私有正文'}});
    const app = new Hono<AppRouteConfig>().route("/api", publicApi);
    const response = await app.request("http://localhost/api/works", {}, { DB: db });
    const body = await response.json() as any;
    const slot = body.schedule.find((entry: any) => entry.preview);
    expect(body.items).toEqual([]);
    expect(slot).toMatchObject({ publicAuthorName: "结界观测者", scheduledAt: "2099-01-01T00:00:00.000Z", workId: null });
    expect(slot.preview.previewTitle).toBeTruthy();
    expect(body.schedule.some((entry: any) => entry.preview === null)).toBe(true);
    expect(JSON.stringify(body)).not.toContain("https://example.com/private");
    expect(Object.keys(slot).sort()).toEqual(["id", "kind", "code", "name", "scheduledAt", "status", "publicAuthorName", "interestFormat", "introText", "preview", "workId"].sort());
    database.sqlite.exec("UPDATE project_drafts SET preview_status = 'submitted' WHERE id = 'draft_seed_active'");
    const pending = await (await app.request("http://localhost/api/works", {}, { DB: db })).json() as any;
    expect(pending.schedule.find((entry: any)=>entry.id==='seg_seed_102').preview.previewTitle).toBe('管理员展示标题');
    expect(JSON.stringify(pending)).not.toContain('私有正文');
  });

  it("distinguishes open, reserved, confirmed and closed slots without publishing pending identities", async () => {
    database.sqlite.exec(`UPDATE schedule_segments SET status = 'held', current_participant_id = 'part_seed_pending' WHERE id = 'seg_seed_101';
      UPDATE schedule_segments SET status = 'completed' WHERE id = 'seg_seed_102';
      UPDATE portal_profiles SET credit_name = '待审核私有署名' WHERE user_id = 'usr_seed_pending'`);
    const app = new Hono<AppRouteConfig>().route("/api", publicApi);
    const body = await (await app.request("http://localhost/api/works", {}, { DB: db })).json() as any;
    expect(body.schedule.find((entry: any) => entry.id === 'seg_seed_101')).toMatchObject({ status: "reserved", publicAuthorName: null, interestFormat: null, introText: null, preview: null });
    expect(body.schedule.find((entry: any) => entry.id === 'seg_seed_102')).toMatchObject({ status: "confirmed", publicAuthorName: "结界观测者" });
    expect(body.schedule.find((entry: any) => entry.id === 'seg_seed_103')).toMatchObject({ status: "unavailable" });
    expect(JSON.stringify(body)).not.toContain('待审核私有署名');
    expect(JSON.stringify(body)).not.toContain('part_seed_pending');
    database.sqlite.exec("UPDATE schedule_segments SET status = 'released', current_participant_id = NULL WHERE id = 'seg_seed_101'");
    const released = await (await app.request("http://localhost/api/works", {}, { DB: db })).json() as any;
    expect(released.schedule.find((entry: any) => entry.id === 'seg_seed_101')).toMatchObject({ status: "available", publicAuthorName: null, interestFormat: null, introText: null, preview: null });
  });

  it("exposes published details during the relay and retains chronological slots afterwards", async () => {
    openWindow(); await readyDraft(); await setWorkPublication(db, draftId, true, actor);
    database.sqlite.exec(`UPDATE schedule_segments SET scheduled_at = '2000-01-01T00:00:00.000Z';
      UPDATE schedule_segments SET scheduled_at = '2099-01-01T00:00:00.000Z' WHERE current_participant_id = 'part_seed_active'`);
    const app = new Hono<AppRouteConfig>().route("/api", publicApi);
    expect((await listPublicWorks(db)).map(work => work.id)).toEqual([draftId]);
    expect((await app.request(`http://localhost/api/works/02`, {}, { DB: db })).status).toBe(200);
    database.sqlite.exec("UPDATE schedule_segments SET scheduled_at = NULL WHERE current_participant_id = 'part_seed_active'");
    expect(await getPublicWork(db, '02')).not.toBeNull();
    database.sqlite.exec("UPDATE schedule_segments SET scheduled_at = '1999-12-31T23:00:00.000Z' WHERE current_participant_id = 'part_seed_active'");
    const body = await (await app.request("http://localhost/api/works", {}, { DB: db })).json() as any;
    expect(body.schedule[0]).toMatchObject({ scheduledAt: "1999-12-31T23:00:00.000Z", workId: draftId });
    expect((await app.request(`http://localhost/api/works/02`, {}, { DB: db })).status).toBe(200);
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

it("migrates mixed types to other, permits cosplay and preserves existing approvals, drafts and assignments", () => {
  const legacy = new DatabaseSync(":memory:");
  try {
    const migration = "0021_cosplay_work_types.sql";
    for (const file of readdirSync("migrations").filter(file => file.endsWith(".sql") && file < migration).sort()) {
      legacy.exec(readFileSync(`migrations/${file}`, "utf8"));
    }
    legacy.exec(buildLocalSeedSql());
    legacy.exec("UPDATE applications SET interest_format = 'mixed' WHERE user_id = 'usr_seed_active'");
    legacy.exec("PRAGMA foreign_keys = ON");
    const tables = ['applications', 'participants', 'project_drafts', 'schedule_segments', 'participant_events', 'segment_swap_requests'];
    const before = tables.map(table => legacy.prepare(`SELECT * FROM ${table} ORDER BY id`).all());
    legacy.exec(`BEGIN; ${readFileSync(`migrations/${migration}`, "utf8")} COMMIT;`);
    tables.forEach((table, index) => {
      const expected = before[index].map(row => table === 'applications' && row.interest_format === 'mixed'
        ? { ...row, interest_format: 'other' } : row);
      expect(legacy.prepare(`SELECT * FROM ${table} ORDER BY id`).all()).toEqual(expected);
    });
    expect(legacy.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    legacy.exec("UPDATE applications SET interest_format = 'cosplay' WHERE user_id = 'usr_seed_active'");
    legacy.exec("UPDATE project_drafts SET work_type = 'cosplay' WHERE id = 'draft_seed_active'");
    expect(legacy.prepare("SELECT interest_format FROM applications WHERE user_id = 'usr_seed_active'").get())
      .toMatchObject({ interest_format: 'cosplay' });
    expect(legacy.prepare("SELECT work_type FROM project_drafts WHERE id = 'draft_seed_active'").get())
      .toMatchObject({ work_type: 'cosplay' });
    expect(() => legacy.exec("UPDATE applications SET interest_format = 'mixed'")).toThrow();
  } finally { legacy.close(); }
});

it('uses exact relay codes for public routes without normalization or legacy ID aliases', async () => {
  openWindow(); await readyDraft(); await setWorkPublication(db, draftId, true, actor);
  const app = new Hono<AppRouteConfig>().route('/api', publicApi);
  const read = (routeId: string) => app.request(`http://localhost/api/works/${routeId}`, {}, { DB: db });
  const regular = await read('02');
  expect(regular.status).toBe(200);
  expect((await regular.json() as any).work).toMatchObject({ id: 'draft_seed_active', segmentCode: '02' });
  expect((await read('draft_seed_active')).status).toBe(404);
  expect((await read('2')).status).toBe(404);
  database.sqlite.exec("UPDATE schedule_segments SET code='EXTRA-01',kind='extra',scheduled_at=NULL WHERE id='seg_seed_102'");
  const extra = await read('EXTRA-01');
  expect(extra.status).toBe(200);
  expect((await extra.json() as any).work).toMatchObject({ id: 'draft_seed_active', segmentCode: 'EXTRA-01' });
  expect((await read('ex1')).status).toBe(404);
  expect((await read('02')).status).toBe(404);
  await setWorkPublication(db, draftId, false, actor);
  expect((await read('EXTRA-01')).status).toBe(404);
});

describe('additional schedule slots', () => {
  it('appends through the protected API with stable codes and leaves all original slots unchanged', async () => {
    const original = database.sqlite.prepare('SELECT * FROM schedule_segments ORDER BY id').all();
    const app = new Hono<AppRouteConfig>().route('/api/admin', adminApi);
    const { env, headers } = await adminTestSession(db);
    const request = (count: number, authenticated = true) => app.request('http://localhost/api/admin/segments/append', {
      method: 'POST', headers: { 'content-type': 'application/json', ...(authenticated ? headers : {}) },
      body: JSON.stringify({ count }),
    }, env);
    expect((await request(2, false)).status).toBe(401);
    expect((await request(0)).status).toBe(422);
    expect((await request(121)).status).toBe(422);
    expect((await request(2)).status).toBe(201);
    const response = await request(1);
    expect(response.status).toBe(201);
    const body = await response.json() as any;
    expect(body.items.filter((item: any) => item.kind === 'extra').map((item: any) => ({ code: item.code, status: item.status, scheduledAt: item.scheduledAt, sortOrder: item.sortOrder })))
      .toEqual([
        { code: 'EXTRA-01', status: 'open', scheduledAt: null, sortOrder: 25 },
        { code: 'EXTRA-02', status: 'open', scheduledAt: null, sortOrder: 26 },
        { code: 'EXTRA-03', status: 'open', scheduledAt: null, sortOrder: 27 },
      ]);
    expect(database.sqlite.prepare("SELECT * FROM schedule_segments WHERE kind = 'standard' ORDER BY id").all()).toEqual(original);
  });

  it('allows eligible participants to claim extra slots and keeps their planned time empty', async () => {
    const result = await appendActiveScheduleSegments(db, { count: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    const extra = result.items.find(item => item.kind === 'extra')!;
    expect((await listAvailableSegments(db)).some(item => item.id === extra.id)).toBe(true);
    database.sqlite.exec("UPDATE event_windows SET is_enabled = 1, opens_at = NULL, closes_at = NULL WHERE key = 'segment_claim_open'");
    database.sqlite.exec("UPDATE participants SET status = 'approved' WHERE id = 'part_seed_pending'");
    const participant = (await getParticipantByUserId(db, 'usr_seed_pending'))!;
    const reservation = await claimParticipantSegment(db, { participant, windows: await listEventWindows(db), segmentId: extra.id });
    expect(reservation).toMatchObject({ ok: true, response: { segment: { code: 'EXTRA-01', scheduledAt: null, status: 'held' } } });
    expect(await getCurrentSegmentForParticipant(db, participant.id)).toMatchObject({ id: extra.id, scheduledAt: null });
    expect(await updateActiveScheduleSegment(db, extra.id, { status: 'open', scheduledAt: '2026-12-01T00:00:00Z' }, actor))
      .toMatchObject({ ok: false, status: 422 });
    expect(await getCurrentSegmentForParticipant(db, participant.id)).toMatchObject({ id: extra.id });
  });

  it('keeps approved published works accessible with unconfigured and extra slots present', async () => {
    openWindow(); await readyDraft(); await setWorkPublication(db, draftId, true, actor);
    database.sqlite.exec("UPDATE schedule_segments SET scheduled_at = '2000-01-01T00:00:00Z' WHERE id = 'seg_seed_101'");
    await appendActiveScheduleSegments(db, { count: 2 });
    expect(await getPublicWork(db, '02')).not.toBeNull();
    const app = new Hono<AppRouteConfig>().route('/api', publicApi);
    const body = await (await app.request('http://localhost/api/works', {}, { DB: db })).json() as any;
    expect(body.schedule.filter((item: any) => item.kind === 'extra')).toHaveLength(2);
    expect(body.schedule.at(-1)).toMatchObject({ kind: 'extra', code: 'EXTRA-02', scheduledAt: null });
    expect(body.items.map((item: any) => item.id)).toContain(draftId);
  });
});
