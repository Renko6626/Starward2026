import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildLocalSeedSql } from "../../scripts/lib/local-dev-bootstrap.mjs";
import { SqliteD1Fixture } from "../test/sqlite-d1";
import { getParticipantByUserId } from "./participants";
import { getPortalProjectDraftDetail, updateAdminProjectDraftReview, updatePortalProjectPreview, updatePortalProjectReview } from "./project-drafts";
import { confirmPortalProjectRelease } from "./relay-publication";
import { getPublicWork, setWorkPublication } from "./works";

let f: SqliteD1Fixture;
const draftId = "draft_seed_active";
const firstTime = "2026-11-11T16:00:00.000Z";
const initialLink = "https://example.com/story";
const participant = async () => (await getParticipantByUserId(f.db, "usr_seed_active"))!;
const confirm = async (workUrl = initialLink) => confirmPortalProjectRelease(f.db, { participant: await participant(), workUrl });

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(firstTime));
  f = new SqliteD1Fixture(); f.sqlite.exec(buildLocalSeedSql());
  f.sqlite.exec(`UPDATE schedule_segments SET scheduled_at = '2026-11-12T15:00:00Z' WHERE current_participant_id = 'part_seed_active';
    UPDATE project_drafts SET preview_status = 'approved', review_status = 'approved', work_type = 'text', work_url = NULL WHERE id = 'draft_seed_active'`);
});
afterEach(() => { f.sqlite.close(); vi.useRealTimers(); });

describe("author release confirmation", () => {
  it("atomically saves the first link, confirms once and immediately exposes the approved work", async () => {
    expect(await confirm()).toMatchObject({ ok: true, draft: { workUrl: initialLink, releaseConfirmedAt: firstTime, publishedAt: firstTime } });
    // Another participant's future slot must not hide this released work.
    f.sqlite.exec("UPDATE schedule_segments SET scheduled_at = '2099-01-01T00:00:00Z' WHERE id = 'seg_seed_101'");
    expect(await getPublicWork(f.db, draftId)).toMatchObject({ work: { workUrl: initialLink } });
    await confirm();
    expect(f.sqlite.prepare("SELECT COUNT(*) AS count FROM participant_events WHERE event_type = 'work_release_confirmed'").get())
      .toMatchObject({ count: 1 });
  });
  it("rejects first confirmation before and after the Beijing publication day without saving a link", async () => {
    for (const now of ["2026-11-11T15:59:59.999Z", "2026-11-12T16:00:00Z"]) {
      vi.setSystemTime(new Date(now));
      expect(await confirm()).toMatchObject({ ok: false, code: "release_not_today" });
      expect(await getPortalProjectDraftDetail(f.db, "part_seed_active"))
        .toMatchObject({ workUrl: null, releaseConfirmedAt: null, publishedAt: null });
    }
  });
  it("allows link replacements after confirmation without changing the first confirmation time", async () => {
    await confirm();
    vi.setSystemTime(new Date("2026-12-01T00:00:00Z"));
    expect(await confirm("https://example.com/corrected"))
      .toMatchObject({ ok: true, draft: { workUrl: "https://example.com/corrected", releaseConfirmedAt: firstTime, publishedAt: firstTime } });
    expect(await confirm("" )).toMatchObject({ ok: false, code: "invalid_work_url" });
    expect(await getPublicWork(f.db, draftId)).toMatchObject({ work: { workUrl: "https://example.com/corrected" } });
  });
  it("records confirmation while review is pending and publishes when both reviews later pass", async () => {
    f.sqlite.exec("UPDATE project_drafts SET review_status = 'submitted' WHERE id = 'draft_seed_active'");
    expect(await confirm()).toMatchObject({ ok: true, draft: { releaseConfirmedAt: firstTime, publishedAt: null } });
    expect(await getPublicWork(f.db, draftId)).toBeNull();
    vi.setSystemTime(new Date("2026-11-13T00:00:00Z"));
    expect(await updateAdminProjectDraftReview(f.db, draftId, { previewStatus: "approved", reviewStatus: "approved" }, "admin"))
      .toMatchObject({ ok: true, draft: { publishedAt: "2026-11-13T00:00:00.000Z" } });
    expect(await getPublicWork(f.db, draftId)).not.toBeNull();
  });
  it("rechecks ownership and date in the transaction when a concurrent admin changes the slot", async () => {
    f.beforeBatch = () => f.sqlite.exec("UPDATE schedule_segments SET scheduled_at = '2026-11-20T00:00:00Z' WHERE current_participant_id = 'part_seed_active'");
    expect(await confirm()).toMatchObject({ ok: false, code: "release_changed" });
    expect(await getPortalProjectDraftDetail(f.db, "part_seed_active"))
      .toMatchObject({ workUrl: null, releaseConfirmedAt: null, publishedAt: null });
  });
  it("rejects invalid URLs, withdrawn participants and slots without a planned date", async () => {
    expect(await confirm("javascript:alert(1)")).toMatchObject({ ok: false, code: "invalid_work_url" });
    f.sqlite.exec("UPDATE schedule_segments SET scheduled_at = NULL WHERE current_participant_id = 'part_seed_active'");
    expect(await confirm()).toMatchObject({ ok: false, code: "release_not_today" });
    f.sqlite.exec("UPDATE participants SET status = 'withdrawn' WHERE id = 'part_seed_active'");
    expect(await confirm()).toMatchObject({ ok: false, code: "release_ineligible" });
  });
  it("treats a first link saved through preview editing as confirmation and preserves it during ordinary edits", async () => {
    expect(await updatePortalProjectPreview(f.db, { participant: await participant(), data: {
      previewTitle: "修改标题", previewSummary: "修改简介", formatLabel: "小说", workType: "text", workUrl: initialLink,
    } })).toMatchObject({ ok: true, draft: { previewStatus: "approved", releaseConfirmedAt: firstTime } });
    vi.setSystemTime(new Date("2026-12-01T00:00:00Z"));
    expect(await updatePortalProjectPreview(f.db, { participant: await participant(), data: {
      previewTitle: "再修改", previewSummary: "简介", formatLabel: "小说", workType: "text",
    } })).toMatchObject({ ok: true, draft: { workUrl: initialLink, releaseConfirmedAt: firstTime, previewStatus: "approved" } });
    expect(await getPublicWork(f.db, draftId)).toMatchObject({ work: { previewTitle: "再修改", workUrl: initialLink } });
  });
  it("preserves confirmation after an admin withdraws the public work and does not republish on link edits", async () => {
    await confirm();
    await setWorkPublication(f.db, draftId, false, "admin");
    expect(await confirm("https://example.com/updated"))
      .toMatchObject({ ok: true, draft: { releaseConfirmedAt: firstTime, publishedAt: null } });
    expect(await getPublicWork(f.db, draftId)).toBeNull();
  });
  it("does not let stale preview saves erase a concurrently confirmed link", async () => {
    f.beforeBatch = () => f.sqlite.prepare(`UPDATE project_drafts SET work_url = ?, release_confirmed_at = ?, published_at = ? WHERE id = ?`)
      .run(initialLink, firstTime, firstTime, draftId);
    expect(await updatePortalProjectPreview(f.db, { participant: await participant(), data: {
      previewTitle: "stale title", previewSummary: "summary", workType: "text", formatLabel: "小说",
    } })).toMatchObject({ ok: false, code: "project_changed" });
    expect(await getPortalProjectDraftDetail(f.db, "part_seed_active"))
      .toMatchObject({ workUrl: initialLink, releaseConfirmedAt: firstTime, publishedAt: firstTime });
  });
  it("detects confirmation during admin approval and publishes on the fresh approval retry", async () => {
    f.sqlite.exec("UPDATE project_drafts SET review_status = 'submitted' WHERE id = 'draft_seed_active'");
    f.beforeBatch = () => f.sqlite.prepare("UPDATE project_drafts SET work_url = ?, release_confirmed_at = ? WHERE id = ?")
      .run(initialLink, firstTime, draftId);
    const approval = { previewStatus: "approved" as const, reviewStatus: "approved" as const };
    expect(await updateAdminProjectDraftReview(f.db, draftId, approval, "admin"))
      .toMatchObject({ ok: false, code: "project_changed" });
    expect(await updateAdminProjectDraftReview(f.db, draftId, approval, "admin"))
      .toMatchObject({ ok: true, draft: { publishedAt: firstTime } });
  });
  it("publishes when missing public metadata is completed after confirmation", async () => {
    f.sqlite.exec("UPDATE project_drafts SET work_type = NULL WHERE id = 'draft_seed_active'");
    expect(await confirm()).toMatchObject({ ok: true, draft: { publishedAt: null } });
    expect(await updatePortalProjectPreview(f.db, { participant: await participant(), data: {
      previewTitle: "ready title", previewSummary: "summary", formatLabel: "小说", workType: "text",
    } })).toMatchObject({ ok: true, draft: { publishedAt: firstTime, releaseConfirmedAt: firstTime } });
  });

  it("rejects a stale review save rather than resetting a concurrent approval", async () => {
    f.sqlite.exec("UPDATE project_drafts SET review_status = 'submitted' WHERE id = 'draft_seed_active'");
    f.beforeBatch = () => f.sqlite.exec("UPDATE project_drafts SET review_status = 'approved' WHERE id = 'draft_seed_active'");
    expect(await updatePortalProjectReview(f.db, { participant: await participant(), data: {
      contentNote: "stale note", contentWarnings: "none",
    } })).toMatchObject({ ok: false, code: "project_changed" });
    expect(await getPortalProjectDraftDetail(f.db, "part_seed_active")).toMatchObject({ reviewStatus: "approved" });
    expect(f.sqlite.prepare("SELECT COUNT(*) AS count FROM participant_events WHERE event_type='project_review_saved'").get())
      .toMatchObject({ count: 0 });
  });

});
