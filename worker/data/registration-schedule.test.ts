import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { SqliteD1Fixture } from "../test/sqlite-d1";
import { adminApi } from "../routes/admin";
import type { AppRouteConfig } from "../lib/types";
import { workspaceApplicationInputSchema, type WorkspaceApplicationInput } from "../../src/shared/collaboration";
import { saveWorkspaceApplication, getCollaboration, getPortalNeighbors, createSwap, respondSwap, withdrawApplication } from "./collaboration";
import { reviewApplication } from "./applications";
import { createActiveScheduleSegment, updateActiveScheduleSegment, updateParticipant, listSegments } from "./admin";
import { listPublicSchedule, listPublicWorks } from "./works";
import { getParticipantByUserId } from "./participants";
import { listAvailableSegments, getPortalSegmentState, getCurrentSegmentForParticipant, claimParticipantSegment, changeParticipantSegment, releaseParticipantSegment } from "./segments";
import { listEventWindows } from "./event-windows";
import { updatePortalProjectPreview } from "./project-drafts";
import { confirmPortalProjectRelease } from "./relay-publication";
import { adminTestSession } from "../test/admin-session";

const fixtures: SqliteD1Fixture[] = [];
afterEach(() => { fixtures.splice(0).forEach(f => f.sqlite.close()); vi.useRealTimers(); });
function fixture(legacy = false) {
  const f = new SqliteD1Fixture(legacy ? { throughMigration: "0021_cosplay_work_types.sql" } : {});
  fixtures.push(f);
  f.sqlite.exec(`UPDATE event_windows SET is_enabled=1,opens_at=NULL,closes_at=NULL;
    INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt) VALUES
    ('u1','One','one@example.com',1,'2026-01-01','2026-01-01'),
    ('u2','Two','two@example.com',1,'2026-01-01','2026-01-01'),
    ('u3','Three','three@example.com',1,'2026-01-01','2026-01-01');
    INSERT INTO schedule_segments(id,schedule_version_id,code,name,status,sort_order,scheduled_at,created_at,updated_at) VALUES
    ('s1','schedule_default','01','早场','open',1,'2026-11-12T10:00:00+08:00','2026-01-01','2026-01-01'),
    ('s2','schedule_default','02','晚场','open',2,'2026-11-12T11:00:00+08:00','2026-01-01','2026-01-01');`);
  return f;
}
function input(segmentId?: string | null): WorkspaceApplicationInput {
  return { segmentId, profile: { creditName: "署名", bilibiliUid: "12345", contactEmail: null, primaryContactChannel: "QQ", primaryContactHandle: "12345", isAnonymous: true }, application: { contactEmail: null, interestFormat: "novel", introText: "小说计划" } };
}
async function approve(f: SqliteD1Fixture, userId: string, segmentId?: string | null) {
  const application = await saveWorkspaceApplication(f.db, userId, null, input(segmentId));
  await reviewApplication(f.db, application.id, { status: "approved" }, "admin");
  return (await getParticipantByUserId(f.db, userId))!;
}
async function special(f: SqliteD1Fixture, participantId?: string) {
  const result = await createActiveScheduleSegment(f.db, { kind: "special", name: "特别席位", scheduledAt: "2026-11-12T10:30:00+08:00" });
  if (!result.ok) throw new Error(result.message);
  const seat = result.items.find(s => s.kind === "special")!;
  if (participantId) expect(await updateActiveScheduleSegment(f.db, seat.id, { status: "held", currentParticipantId: participantId }, "admin")).toMatchObject({ ok: true });
  return seat.id;
}

describe("registration independent of capacity", () => {
  it("accepts omitted and null choices, including a full timetable, then allows approved work editing", async () => {
    const f = fixture();
    expect(workspaceApplicationInputSchema.safeParse(input()).success).toBe(true);
    expect(workspaceApplicationInputSchema.safeParse(input(null)).success).toBe(true);
    await approve(f, "u1", "s1");
    await approve(f, "u2", "s2");
    const before = f.sqlite.prepare("SELECT * FROM schedule_segments ORDER BY id").all();
    const participant = await approve(f, "u3");
    expect(await getCurrentSegmentForParticipant(f.db, participant.id)).toBeNull();
    expect(f.sqlite.prepare("SELECT segment_id AS segmentId FROM project_drafts WHERE participant_id=?").get(participant.id)).toMatchObject({ segmentId: null });
    expect(await updatePortalProjectPreview(f.db, { participant, data: { previewTitle: "新作品", previewSummary: "简介", formatLabel: "小说", workType: "text" } })).toMatchObject({ ok: true });
    expect(f.sqlite.prepare("SELECT * FROM schedule_segments ORDER BY id").all()).toEqual(before);
  });

  it("releases a pending reservation when choosing host arrangement and links the first approved draft", async () => {
    const f = fixture();
    const first = await approve(f, "u1", "s1");
    expect(f.sqlite.prepare("SELECT segment_id AS segmentId FROM project_drafts WHERE participant_id=?").get(first.id)).toMatchObject({ segmentId: "s1" });
    await saveWorkspaceApplication(f.db, "u2", null, input("s2"));
    await saveWorkspaceApplication(f.db, "u2", null, input(null));
    expect(f.sqlite.prepare("SELECT status,current_participant_id FROM schedule_segments WHERE id='s2'").get()).toMatchObject({ status: "released", current_participant_id: null });
    f.sqlite.exec("UPDATE event_windows SET is_enabled=0 WHERE key='application_open'");
    await expect(saveWorkspaceApplication(f.db, "u3", null, input(null))).rejects.toThrow();
  });
});

describe("timed seats and private relay", () => {
  it("hides and restores a slot through the protected API without changing its assignment or work", async () => {
    const f = fixture();
    await approve(f, "u1", "s1");
    await approve(f, "u2", "s2");
    const before = f.sqlite.prepare("SELECT * FROM schedule_segments WHERE id='s2'").get()!;
    const drafts = f.sqlite.prepare("SELECT * FROM project_drafts ORDER BY id").all();
    const admin = await adminTestSession(f.db);
    const app = new Hono<AppRouteConfig>().route("/api/admin", adminApi);
    const request = (body: unknown, authenticated = true) => app.request("http://localhost/api/admin/segments/s2", {
      method: "PATCH", headers: { "content-type": "application/json", ...(authenticated ? admin.headers : {}) }, body: JSON.stringify(body),
    }, admin.env);
    expect((await request({ mode: "set-visibility", isVisible: false }, false)).status).toBe(401);
    expect((await request({ mode: "set-visibility", isVisible: "false" })).status).toBe(422);
    expect((await request({ mode: "set-visibility", isVisible: false })).status).toBe(200);
    expect((await listSegments(f.db)).find(s => s.id === "s2")).toMatchObject({ isVisible: false });
    expect((await listPublicSchedule(f.db, [])).map(s => s.id)).toEqual(["s1"]);
    expect((await getCollaboration(f.db, "u2")).segments.map(s => s.id)).toEqual(["s1"]);
    expect((await getPortalNeighbors(f.db, "u1")).next).toBeNull();
    expect(await getPortalNeighbors(f.db, "u2")).toEqual({ currentSegmentId: null, previous: null, next: null });
    expect(f.sqlite.prepare("SELECT * FROM schedule_segments WHERE id='s2'").get()).toEqual({ ...before, is_visible: 0, updated_at: expect.any(String) });
    expect(f.sqlite.prepare("SELECT * FROM project_drafts ORDER BY id").all()).toEqual(drafts);
    expect((await request({ mode: "set-visibility", isVisible: true })).status).toBe(200);
    expect((await getPortalNeighbors(f.db, "u1")).next?.segmentId).toBe("s2");
    expect((await listPublicSchedule(f.db, [])).map(s => s.id)).toEqual(["s1", "s2"]);
  });

  it("skips hidden middle slots and rejects stale registration, claim and change requests", async () => {
    const f = fixture();
    const one = await approve(f, "u1", "s1");
    const two = await approve(f, "u2");
    const created = await createActiveScheduleSegment(f.db, { kind: "standard", name: "中场", scheduledAt: "2026-11-12T10:30:00+08:00" });
    if (!created.ok) throw new Error(created.message);
    const middle = created.items.find(s => s.name === "中场")!;
    expect(await updateActiveScheduleSegment(f.db, middle.id, { mode: "set-visibility", isVisible: false }, "admin")).toMatchObject({ ok: true });
    expect((await getPortalNeighbors(f.db, "u1")).next?.segmentId).toBe("s2");
    expect((await listAvailableSegments(f.db)).map(s => s.id)).toEqual(["s2"]);
    await expect(saveWorkspaceApplication(f.db, "u3", null, input(middle.id))).rejects.toThrow();
    const windows = await listEventWindows(f.db);
    expect(await claimParticipantSegment(f.db, { participant: two, windows, segmentId: middle.id })).toMatchObject({ ok: false });
    expect(await changeParticipantSegment(f.db, { participant: one, windows, segmentId: middle.id })).toMatchObject({ ok: false });
    expect((await getCurrentSegmentForParticipant(f.db, one.id))?.id).toBe("s1");
  });

  it("rejects exchanges created or accepted after either slot is hidden", async () => {
    const f = fixture();
    const one = await approve(f, "u1", "s1"), two = await approve(f, "u2", "s2");
    const request = await createSwap(f.db, one.id, "s2");
    await updateActiveScheduleSegment(f.db, "s2", { mode: "set-visibility", isVisible: false }, "admin");
    await expect(createSwap(f.db, one.id, "s2")).rejects.toThrow();
    await expect(respondSwap(f.db, two.id, request.id, "accept")).rejects.toThrow();
    expect((await getCurrentSegmentForParticipant(f.db, one.id))?.id).toBe("s1");
    expect((await getCurrentSegmentForParticipant(f.db, two.id))?.id).toBe("s2");
  });

  it("preserves a hidden reservation when its pending author saves the application without a visible choice", async () => {
    const f = fixture();
    await saveWorkspaceApplication(f.db, "u1", null, input("s1"));
    const participant = (await getParticipantByUserId(f.db, "u1"))!;
    await updateActiveScheduleSegment(f.db, "s1", { mode: "set-visibility", isVisible: false }, "admin");
    expect((await getCollaboration(f.db, "u1")).segments.map(s => s.id)).toEqual(["s2"]);
    const edited = input(null);
    edited.application.introText = "更新后的创作意向";
    await saveWorkspaceApplication(f.db, "u1", null, edited);
    expect((await getCurrentSegmentForParticipant(f.db, participant.id))?.id).toBe("s1");
    expect(f.sqlite.prepare("SELECT intro_text FROM applications WHERE user_id='u1'").get()).toMatchObject({ intro_text: "更新后的创作意向" });
    await saveWorkspaceApplication(f.db, "u1", null, input("s2"));
    expect((await getCurrentSegmentForParticipant(f.db, participant.id))?.id).toBe("s2");
  });

  it("creates timed seats through the protected API and orders insertion and time edits consistently", async () => {
    const f = fixture();
    await approve(f, "u1", "s1");
    await approve(f, "u2", "s2");
    const admin = await adminTestSession(f.db);
    const app = new Hono<AppRouteConfig>().route("/api/admin", adminApi);
    const request = (body: unknown, authenticated = true) => app.request("http://localhost/api/admin/segments", {
      method: "POST", headers: { "content-type": "application/json", ...(authenticated ? admin.headers : {}) }, body: JSON.stringify(body),
    }, admin.env);
    const data = { kind: "standard", name: "半点加场", scheduledAt: "2026-11-12T10:30:00+08:00" };
    expect((await request(data, false)).status).toBe(401);
    expect((await request({ ...data, scheduledAt: null })).status).toBe(422);
    expect((await request(data)).status).toBe(201);
    const inserted = (await listPublicSchedule(f.db, [])).find(s => s.name === data.name)!;
    expect((await listPublicSchedule(f.db, [])).map(s => s.id)).toEqual(["s1", inserted.id, "s2"]);
    expect((await getPortalNeighbors(f.db, "u1")).next?.segmentId).toBe(inserted.id);
    expect(await updateActiveScheduleSegment(f.db, inserted.id, { status: "open", scheduledAt: "2026-11-12T09:30:00+08:00" }, "admin")).toMatchObject({ ok: true });
    expect((await listPublicSchedule(f.db, [])).map(s => s.id)).toEqual([inserted.id, "s1", "s2"]);
    expect((await getPortalNeighbors(f.db, "u1")).previous?.segmentId).toBe(inserted.id);
    expect(f.sqlite.prepare("SELECT id FROM schedule_segments ORDER BY sort_order").all().map(s => s.id)).toEqual([inserted.id, "s1", "s2"]);
  });

  it("hides special seats from public, vacant choices and unrelated authors, but lets adjacent authors swap", async () => {
    const f = fixture();
    const one = await approve(f, "u1", "s1");
    const two = await approve(f, "u2");
    const id = await special(f, two.id);
    expect((await listPublicSchedule(f.db, [])).map(s => s.id)).not.toContain(id);
    expect((await listAvailableSegments(f.db)).map(s => s.id)).not.toContain(id);
    expect((await getCollaboration(f.db, "u1")).segments.map(s => s.id)).not.toContain(id);
    expect((await getCollaboration(f.db, "u2")).segments.map(s => s.id)).toContain(id);
    expect(await getPortalNeighbors(f.db, "u3")).toEqual({ currentSegmentId: null, previous: null, next: null });
    expect((await getPortalNeighbors(f.db, "u1")).next).toMatchObject({ segmentId: id, kind: "special", publicName: "匿名创作者", bilibiliUid: "12345" });
    const request = await createSwap(f.db, one.id, id);
    await respondSwap(f.db, two.id, request.id, "accept");
    expect(await getCurrentSegmentForParticipant(f.db, one.id)).toMatchObject({ id, kind: "special" });
    expect(f.sqlite.prepare("SELECT segment_id AS segmentId FROM project_drafts WHERE participant_id=?").get(one.id)).toMatchObject({ segmentId: id });
    expect(await changeParticipantSegment(f.db, { participant: one, windows: await listEventWindows(f.db), segmentId: "s2" })).toMatchObject({ ok: true });
    await expect(saveWorkspaceApplication(f.db, "u3", null, input(id))).rejects.toThrow();
    expect(await changeParticipantSegment(f.db, { participant: one, windows: await listEventWindows(f.db), segmentId: id })).toMatchObject({ ok: false });
    const three = await approve(f, "u3");
    expect(await claimParticipantSegment(f.db, { participant: three, windows: await listEventWindows(f.db), segmentId: id })).toMatchObject({ ok: false });
  });

  it("rejects a guessed special target beyond the immediate neighbors", async () => {
    const f = fixture();
    const one = await approve(f, "u1", "s1");
    const two = await approve(f, "u2");
    const id = await special(f, two.id);
    await updateActiveScheduleSegment(f.db, id, { status: "held", scheduledAt: "2026-11-12T12:00:00+08:00" }, "admin");
    expect((await getPortalNeighbors(f.db, "u1")).next?.segmentId).toBe("s2");
    await expect(createSwap(f.db, one.id, id)).rejects.toThrow();
  });

  it("uses the special publication day and publishes its work in the public collection", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-11T16:00:00Z"));
    const f = fixture();
    const participant = await approve(f, "u1");
    const id = await special(f, participant.id);
    f.sqlite.exec("UPDATE project_drafts SET preview_title='特别作品',preview_summary='简介',work_type='text',preview_status='approved',review_status='approved'");
    expect(await confirmPortalProjectRelease(f.db, { participant, workUrl: "https://example.com/special" })).toMatchObject({ ok: true });
    expect((await listPublicWorks(f.db)).map(w => w.previewTitle)).toContain("特别作品");
    expect((await listPublicSchedule(f.db, await listPublicWorks(f.db))).map(s => s.id)).not.toContain(id);
    expect(await releaseParticipantSegment(f.db, { participant, windows: await listEventWindows(f.db) })).toMatchObject({ ok: true });
    expect((await listAvailableSegments(f.db)).map(s => s.id)).not.toContain(id);
  });
});

describe("preserved assignments and transaction safety", () => {
  it.each(["locked", "completed"] as const)("retains %s owners and drafts, freezes author changes and allows admin reassignment", async status => {
    const f = fixture();
    const one = await approve(f, "u1", "s1"), two = await approve(f, "u2", "s2");
    const swap = await createSwap(f.db, one.id, "s2");
    expect(await updateActiveScheduleSegment(f.db, "s1", { status }, "admin")).toMatchObject({ ok: true });
    expect(await getCurrentSegmentForParticipant(f.db, one.id)).toMatchObject({ id: "s1", status });
    expect(f.sqlite.prepare("SELECT segment_id AS segmentId FROM project_drafts WHERE participant_id=?").get(one.id)).toMatchObject({ segmentId: "s1" });
    expect((await listPublicSchedule(f.db, [])).find(s => s.id === "s1")).toMatchObject({ status: "confirmed" });
    expect((await getCollaboration(f.db, "u1")).canSwap).toBe(false);
    await expect(respondSwap(f.db, two.id, swap.id, "accept")).rejects.toThrow();
    const windows = await listEventWindows(f.db);
    expect(await releaseParticipantSegment(f.db, { participant: one, windows })).toMatchObject({ ok: false });
    await expect(withdrawApplication(f.db, "u1")).rejects.toThrow();
    await updateParticipant(f.db, one.id, { status: "completed" }, "admin");
    expect(await getPortalSegmentState(f.db, { participant: (await getParticipantByUserId(f.db, "u1"))!, windows })).toMatchObject({ actions: { canClaim: false, canChange: false, canRelease: false } });
    expect(await getCurrentSegmentForParticipant(f.db, one.id)).toMatchObject({ id: "s1" });
    expect(f.sqlite.prepare("SELECT segment_id AS segmentId FROM project_drafts WHERE participant_id=?").get(one.id)).toMatchObject({ segmentId: "s1" });
    expect(await updateActiveScheduleSegment(f.db, "s1", { status: "held", currentParticipantId: two.id }, "admin")).toMatchObject({ ok: true });
    expect(f.sqlite.prepare("SELECT segment_id AS segmentId FROM project_drafts WHERE participant_id=?").get(two.id)).toMatchObject({ segmentId: "s1" });
    expect(f.sqlite.prepare("SELECT segment_id AS segmentId FROM project_drafts WHERE participant_id=?").get(one.id)).toMatchObject({ segmentId: null });
  });

  it("lets a locked pending author edit the application while preserving the frozen assignment", async () => {
    const f = fixture();
    await saveWorkspaceApplication(f.db, "u1", null, input("s1"));
    await updateActiveScheduleSegment(f.db, "s1", { status: "locked" }, "admin");
    await saveWorkspaceApplication(f.db, "u1", null, { ...input("s1"), application: { ...input().application, introText: "更新计划" } });
    expect(f.sqlite.prepare("SELECT status FROM schedule_segments WHERE id='s1'").get()).toMatchObject({ status: "locked" });
    await expect(saveWorkspaceApplication(f.db, "u1", null, input(null))).rejects.toThrow();
  });

  it("rejects stale admin assignments without detaching either draft or reordering", async () => {
    const f = fixture();
    const one = await approve(f, "u1", "s1"), two = await approve(f, "u2", "s2");
    f.beforeBatch = () => f.sqlite.exec("UPDATE schedule_segments SET updated_at='2099-01-01', sort_order=10 WHERE id='s2'");
    expect(await updateActiveScheduleSegment(f.db, "s2", { status: "held", currentParticipantId: one.id }, "admin")).toMatchObject({ ok: false, status: 409 });
    expect(f.sqlite.prepare("SELECT segment_id AS segmentId FROM project_drafts WHERE participant_id=?").get(one.id)).toMatchObject({ segmentId: "s1" });
    expect(f.sqlite.prepare("SELECT segment_id AS segmentId FROM project_drafts WHERE participant_id=?").get(two.id)).toMatchObject({ segmentId: "s2" });
    expect(f.sqlite.prepare("SELECT sort_order FROM schedule_segments WHERE id='s2'").get()).toMatchObject({ sort_order: 10 });
  });


  it("leaves seats and drafts untouched when the active schedule changes before an admin assignment", async () => {
    const f = fixture();
    const one = await approve(f, "u1", "s1");
    const seats = f.sqlite.prepare("SELECT * FROM schedule_segments ORDER BY id").all();
    f.beforeBatch = () => f.sqlite.exec("UPDATE schedule_versions SET status='archived' WHERE id='schedule_default'");
    expect(await updateActiveScheduleSegment(f.db, "s2", { status: "held", currentParticipantId: one.id }, "admin")).toMatchObject({ ok: false, status: 409 });
    expect(f.sqlite.prepare("SELECT * FROM schedule_segments ORDER BY id").all()).toEqual(seats);
    expect(f.sqlite.prepare("SELECT segment_id FROM project_drafts WHERE participant_id=?").get(one.id)).toMatchObject({ segment_id: "s1" });
  });

  it("migrates populated schedules with drafts and swaps, repairs missing links and preserves foreign keys", async () => {
    const f = fixture(true);
    // Seed the historical schema directly: current application code requires later migrations.
    const one = { id: "p1" }, two = { id: "p2" }, request = { id: "swap_legacy" };
    for (const n of [1, 2]) {
      f.sqlite.prepare("INSERT INTO applications(id,user_id,interest_format,status,created_at,updated_at) VALUES(?,?,'novel','approved','2026-01-01','2026-01-01')").run(`a${n}`, `u${n}`);
      f.sqlite.prepare("INSERT INTO participants(id,user_id,application_id,status,created_at,updated_at) VALUES(?,?,?,'approved','2026-01-01','2026-01-01')").run(`p${n}`, `u${n}`, `a${n}`);
      f.sqlite.prepare("UPDATE schedule_segments SET status='held',current_participant_id=? WHERE id=?").run(`p${n}`, `s${n}`);
      f.sqlite.prepare("INSERT INTO project_drafts(id,participant_id,segment_id,preview_status,review_status,created_at,updated_at) VALUES(?,?,?,'not_started','not_started','2026-01-01','2026-01-01')").run(`d${n}`, `p${n}`, `s${n}`);
    }
    f.sqlite.exec("INSERT INTO segment_swap_requests(id,requester_id,recipient_id,requester_segment_id,recipient_segment_id,status,created_at,updated_at) VALUES('swap_legacy','p1','p2','s1','s2','pending','2026-01-01','2026-01-01')");
    f.sqlite.prepare("UPDATE project_drafts SET segment_id=NULL WHERE participant_id=?").run(two.id);
    const seats = f.sqlite.prepare("SELECT * FROM schedule_segments ORDER BY id").all();
    const swaps = f.sqlite.prepare("SELECT * FROM segment_swap_requests").all();
    f.sqlite.exec("BEGIN");
    f.sqlite.exec(readFileSync("migrations/0022_registration_schedule.sql", "utf8"));
    f.sqlite.exec("COMMIT");
    expect(f.sqlite.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    expect(f.sqlite.prepare("SELECT * FROM schedule_segments ORDER BY id").all()).toEqual(seats);
    expect(f.sqlite.prepare("SELECT * FROM segment_swap_requests").all()).toEqual(swaps);
    expect(f.sqlite.prepare("SELECT segment_id AS segmentId FROM project_drafts WHERE participant_id=?").get(one.id)).toMatchObject({ segmentId: "s1" });
    expect(f.sqlite.prepare("SELECT segment_id AS segmentId FROM project_drafts WHERE participant_id=?").get(two.id)).toMatchObject({ segmentId: "s2" });
    f.sqlite.exec(readFileSync("migrations/0023_schedule_slot_visibility.sql", "utf8"));
    expect(f.sqlite.prepare("SELECT * FROM schedule_segments ORDER BY id").all()).toEqual(seats.map(seat => ({ ...seat, is_visible: 1 })));
    await updateActiveScheduleSegment(f.db, "s2", { status: "held", scheduledAt: "2026-11-12T11:30:00+08:00" }, "admin");
    expect(f.sqlite.prepare("SELECT status FROM segment_swap_requests WHERE id=?").get(request.id)).toMatchObject({ status: "expired" });
  });
});
