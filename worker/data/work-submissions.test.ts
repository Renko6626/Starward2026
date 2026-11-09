import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { SqliteD1Fixture } from '../test/sqlite-d1';
import { buildLocalSeedSql } from '../../scripts/lib/local-dev-bootstrap.mjs';
import { createWorkSubmission, createWorkSubmissionReview, getWorkSubmissionWorkspace, getWorkSubmissionDetail } from './work-submissions';

let fixture: SqliteD1Fixture;
beforeEach(() => {
  fixture = new SqliteD1Fixture(); fixture.sqlite.exec(buildLocalSeedSql());
  fixture.sqlite.exec("UPDATE event_windows SET is_enabled = 1, opens_at = NULL, closes_at = '2026-01-01T00:00:00Z' WHERE key = 'work_upload_open'");
});
afterEach(() => fixture.sqlite.close());
function file(id: string, draft = 'draft_seed_active', completed = true) {
  fixture.sqlite.prepare(`INSERT INTO work_files (id,draft_id,object_key,upload_id,filename,size,content_type,created_at,completed_at)
    VALUES (?,?,?,?,?,3,'text/plain','2026-10-31',?)`).run(id,draft,id,id,`${id}.txt`,completed ? '2026-10-31' : null);
}
async function submit(id: string) {
  file(id);
  const result = await createWorkSubmission(fixture.db, 'part_seed_active', { title: id, workType: 'text', summary: '作品简介', fileIds: [id] });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.message);
  return result.workspace.latest!;
}
describe('complete work versions', () => {
  it('upgrades the old schema without changing existing files, reviews or publication', () => {
    const old = new SqliteD1Fixture({ throughMigration: '0024_work_files.sql' });
    try {
      old.sqlite.exec(buildLocalSeedSql());
      old.sqlite.exec("UPDATE project_drafts SET preview_status='approved', review_status='approved', published_at='2026-10-20' WHERE id='draft_seed_active'");
      old.sqlite.exec("INSERT INTO work_files VALUES ('old','draft_seed_active','old-key','upload','old.txt',3,'text/plain','2026-10-20','2026-10-20')");
      old.sqlite.exec(readFileSync(new URL('../../migrations/0025_work_submissions.sql', import.meta.url), 'utf8'));
      expect(old.sqlite.prepare('SELECT object_key,submission_id FROM work_files').get()).toEqual({ object_key: 'old-key', submission_id: null });
      expect(old.sqlite.prepare("SELECT published_at FROM project_drafts WHERE id='draft_seed_active'").get()).toEqual({ published_at: '2026-10-20' });
      expect(old.sqlite.prepare('SELECT * FROM work_submission_reviews').all()).toEqual([]);
      expect(old.sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    } finally { old.sqlite.close(); }
  });
  it('creates complete immutable versions after the old cutoff and keeps pending uploads separate', async () => {
    file('pending');
    expect((await getWorkSubmissionWorkspace(fixture.db, 'draft_seed_active')).review.status).toBe('not_submitted');
    const first = await submit('first'); const second = await submit('second');
    expect([first.versionNumber, second.versionNumber]).toEqual([1, 2]);
    expect((await getWorkSubmissionDetail(fixture.db, 'draft_seed_active', first.id))?.files.map(f => f.id)).toEqual(['first']);
    expect(second.files.map(f => f.id)).toEqual(['second']);
    expect((await getWorkSubmissionWorkspace(fixture.db, 'draft_seed_active')).pendingFiles.map(f => f.id)).toEqual(['pending']);
    expect(await getWorkSubmissionDetail(fixture.db, 'draft_seed_pending', first.id)).toBeNull();
  });
  it('rejects uncompleted, foreign, duplicated and already submitted files without partial versions', async () => {
    const first = await submit('first'); file('unfinished', 'draft_seed_active', false); file('foreign', 'draft_seed_pending');
    for (const ids of [['first'], ['unfinished'], ['foreign'], ['unfinished', 'foreign'], ['first', 'first']]) {
      expect((await createWorkSubmission(fixture.db, 'part_seed_active', { title: 'bad', workType: 'text', summary: '简介', fileIds: ids })).ok).toBe(false);
    }
    expect((await getWorkSubmissionWorkspace(fixture.db, 'draft_seed_active')).versions.map(v => v.id)).toEqual([first.id]);
  });
  it('keeps the approved baseline, exposes comments and handles explicit re-review', async () => {
    const v1 = await submit('v1');
    expect((await createWorkSubmissionReview(fixture.db, 'draft_seed_active', v1.id, { decision: 'approved', feedback: '通过' }, 'host')).ok).toBe(true);
    const v2 = await submit('v2');
    let workspace = await getWorkSubmissionWorkspace(fixture.db, 'draft_seed_active');
    expect(workspace.review).toMatchObject({ status: 'approved', decisionVersionNumber: 1, hasUpdatesAfterReview: true });
    expect(workspace.firstApprovedSubmission?.id).toBe(v1.id);
    expect((await createWorkSubmissionReview(fixture.db, 'draft_seed_active', v1.id, { decision: 'rejected', feedback: '过期页面' }, 'host')).ok).toBe(false);
    await createWorkSubmissionReview(fixture.db, 'draft_seed_active', v2.id, { feedback: '留意字幕' }, 'host');
    workspace = await getWorkSubmissionWorkspace(fixture.db, 'draft_seed_active');
    expect(workspace.latestFeedback).toMatchObject({ feedback: '留意字幕', versionNumber: 2 });
    expect(workspace.review.status).toBe('approved');
    expect((await createWorkSubmissionReview(fixture.db, 'draft_seed_active', v2.id, { decision: 'changes_requested', feedback: '请删去新增片段' }, 'host')).ok).toBe(true);
    expect((await getWorkSubmissionWorkspace(fixture.db, 'draft_seed_active')).review.status).toBe('changes_requested');
    await submit('v3');
    expect((await getWorkSubmissionWorkspace(fixture.db, 'draft_seed_active')).review.status).toBe('pending');
    expect((await createWorkSubmissionReview(fixture.db, 'draft_seed_active', v2.id, { decision: 'rejected', feedback: '' }, 'host')).ok).toBe(false);
  });
  it('retains a published legacy snapshot on submission and requires withdrawal before a negative decision', async () => {
    fixture.sqlite.exec("UPDATE project_drafts SET preview_status='approved', review_status='approved', published_at='2026-10-20' WHERE id='draft_seed_active'");
    fixture.sqlite.exec("INSERT INTO work_presentations (segment_id,draft_id,title,summary,published_at,created_at,updated_at) VALUES ('seg_seed_102','draft_seed_active','历史作品','历史简介','2026-10-20','2026-10-20','2026-10-20')");
    const version = await submit('complete');
    expect((await createWorkSubmissionReview(fixture.db, 'draft_seed_active', version.id, { decision: 'rejected', feedback: '需撤下' }, 'host')).ok).toBe(false);
    expect(fixture.sqlite.prepare("SELECT published_at FROM project_drafts WHERE id='draft_seed_active'").get()).toEqual({ published_at: '2026-10-20' });
  });
});
