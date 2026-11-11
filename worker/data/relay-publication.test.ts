import { createWorkSubmissionReview } from './work-submissions';
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildLocalSeedSql } from "../../scripts/lib/local-dev-bootstrap.mjs";
import { SqliteD1Fixture } from "../test/sqlite-d1";
import { getParticipantByUserId } from "./participants";
import { getPortalProjectDraftDetail, updatePortalProjectPreview } from "./project-drafts";
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
  f.sqlite.exec(`INSERT INTO work_submissions (id,draft_id,version_number,title,work_type,summary,submitted_at)
    VALUES ('version_seed','draft_seed_active',1,'成品','text','简介','2026-10-31');
    INSERT INTO work_submission_reviews (submission_id,decision,reviewed_by,created_at) VALUES ('version_seed','approved','host','2026-10-31')`);
});
afterEach(() => { f.sqlite.close(); vi.useRealTimers(); });

describe("author release confirmation", () => {
  it("atomically saves the first link and confirms once without automatically publishing", async () => {
    expect(await confirm()).toMatchObject({ ok: true, draft: { workUrl: initialLink, releaseConfirmedAt: firstTime, publishedAt: null } });
    // Another participant's future slot must not hide this released work.
    f.sqlite.exec("UPDATE schedule_segments SET scheduled_at = '2099-01-01T00:00:00Z' WHERE id = 'seg_seed_101'");
    expect(await getPublicWork(f.db, '02')).toBeNull();
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
      .toMatchObject({ ok: true, draft: { workUrl: "https://example.com/corrected", releaseConfirmedAt: firstTime, publishedAt: null } });
    expect(await confirm("" )).toMatchObject({ ok: false, code: "invalid_work_url" });
    expect(await getPublicWork(f.db, '02')).toBeNull();
  });
  it("records confirmation while content review is pending and still waits for manual publication after approval", async () => {
    f.sqlite.exec("DELETE FROM work_submission_reviews; UPDATE project_drafts SET review_status = 'submitted' WHERE id = 'draft_seed_active'");
    expect(await confirm()).toMatchObject({ ok: true, draft: { releaseConfirmedAt: firstTime, publishedAt: null } });
    expect(await getPublicWork(f.db, '02')).toBeNull();
    vi.setSystemTime(new Date("2026-11-13T00:00:00Z"));
    expect(await createWorkSubmissionReview(f.db,draftId,"version_seed",{decision:"approved"},"admin")).toMatchObject({ok:true});
    expect(await getPortalProjectDraftDetail(f.db,"part_seed_active")).toMatchObject({publishedAt:null});
    expect(await getPublicWork(f.db, '02')).toBeNull();
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
  it("rejects the legacy metadata editing path instead of bypassing version review", async () => {
    expect(await updatePortalProjectPreview(f.db,{participant:await participant(),data:{workUrl:initialLink,previewTitle:'旁路标题'}}))
      .toMatchObject({ok:false,status:410});
    expect(await getPortalProjectDraftDetail(f.db,'part_seed_active')).toMatchObject({workUrl:null,releaseConfirmedAt:null});
  });
  it("preserves confirmation after an admin withdraws the public work and does not republish on link edits", async () => {
    await confirm();
    await setWorkPublication(f.db, draftId, false, "admin");
    expect(await confirm("https://example.com/updated"))
      .toMatchObject({ ok: true, draft: { releaseConfirmedAt: firstTime, publishedAt: null } });
    expect(await getPublicWork(f.db, '02')).toBeNull();
  });
  it("does not let stale preview saves erase a concurrently confirmed link", async () => {
    f.beforeBatch = () => f.sqlite.prepare(`UPDATE project_drafts SET work_url = ?, release_confirmed_at = ?, published_at = ? WHERE id = ?`)
      .run(initialLink, firstTime, firstTime, draftId);
    expect(await updatePortalProjectPreview(f.db, { participant: await participant(), data: {
      previewTitle: "stale title", previewSummary: "summary", workType: "text", formatLabel: "小说",
    } })).toMatchObject({ ok: false, code: "project_changed" });
    expect(await getPortalProjectDraftDetail(f.db, "part_seed_active"))
      .toMatchObject({ workUrl: initialLink, releaseConfirmedAt: firstTime, publishedAt: null });
  });
  it("retains a release link confirmed while the host saves content approval", async () => {
    f.sqlite.exec('DELETE FROM work_submission_reviews');
    f.beforeBatch = () => f.sqlite.prepare('UPDATE project_drafts SET work_url=?,release_confirmed_at=? WHERE id=?').run(initialLink,firstTime,draftId);
    expect(await createWorkSubmissionReview(f.db,draftId,'version_seed',{decision:'approved'},'admin')).toMatchObject({ok:true});
    expect(await getPortalProjectDraftDetail(f.db,'part_seed_active')).toMatchObject({publishedAt:null,workUrl:initialLink});
  });
  it("does not publish when missing public metadata is completed after confirmation", async () => {
    f.sqlite.exec("UPDATE project_drafts SET work_type = NULL WHERE id = 'draft_seed_active'");
    expect(await confirm()).toMatchObject({ ok: true, draft: { publishedAt: null } });
    expect(await createWorkSubmissionReview(f.db,draftId,'version_seed',{decision:'approved'},'admin')).toMatchObject({ok:true});
    expect(await getPortalProjectDraftDetail(f.db,'part_seed_active')).toMatchObject({publishedAt:null,releaseConfirmedAt:firstTime});
  });

});
