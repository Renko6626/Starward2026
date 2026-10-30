import {
  createWorkSubmissionSchema, createWorkSubmissionReviewSchema, summarizeWorkReview,
  type CreateWorkSubmissionInput, type CreateWorkSubmissionReviewInput,
  type WorkSubmissionSummary, type WorkSubmissionDetail, type WorkSubmissionReview,
  type WorkSubmissionWorkspace, type WorkSubmissionMutationResult, type WorkReviewSummary,
} from '../../src/shared/work-submissions';
import type { WorkFile } from '../../src/shared/work-files';
import { getPortalProjectDraftDetail } from './project-drafts';
import { listEventWindows } from './event-windows';
import { getWindowOrFallback } from '../lib/windows';
import { createPrefixedId } from '../lib/ids';
import { nowIso } from '../lib/time';
import { publishConfirmedProjectIfReady } from './relay-publication';

const summarySql = `SELECT s.id, s.version_number AS versionNumber, s.title, s.work_type AS workType,
  s.summary, s.version_note AS versionNote, s.submitted_at AS submittedAt,
  (SELECT COUNT(*) FROM work_files f WHERE f.submission_id=s.id) AS fileCount FROM work_submissions s`;
const reviewSql = `SELECT r.id, r.submission_id AS submissionId, s.version_number AS versionNumber,
  r.feedback, r.decision, r.created_at AS createdAt FROM work_submission_reviews r
  JOIN work_submissions s ON s.id=r.submission_id`;
const fail = (status: number, code: string, message: string) => ({ ok: false as const, status, code, message });

export async function getWorkReviewSummary(db: D1Database, draftId: string): Promise<WorkReviewSummary> {
  const latest = await db.prepare('SELECT MAX(version_number) AS version FROM work_submissions WHERE draft_id=?')
    .bind(draftId).first<{ version: number | null }>();
  const decision = await db.prepare(reviewSql + ' WHERE s.draft_id=? AND r.decision IS NOT NULL ORDER BY r.id DESC LIMIT 1')
    .bind(draftId).first<WorkSubmissionReview>();
  return summarizeWorkReview(latest?.version ?? null, decision?.decision ? { ...decision, decision: decision.decision } : null);
}

export async function getWorkSubmissionDetail(db: D1Database, draftId: string, submissionId: string): Promise<WorkSubmissionDetail | null> {
  const summary = await db.prepare(summarySql + ' WHERE s.draft_id=? AND s.id=?').bind(draftId, submissionId).first<WorkSubmissionSummary>();
  if (!summary) return null;
  const { results: files } = await db.prepare(`SELECT id, filename, size, content_type AS contentType, created_at AS createdAt
    FROM work_files WHERE draft_id=? AND submission_id=? AND completed_at IS NOT NULL ORDER BY created_at,id`)
    .bind(draftId, submissionId).all<WorkFile>();
  const { results: reviews } = await db.prepare(reviewSql + ' WHERE s.draft_id=? AND s.id=? ORDER BY r.id DESC')
    .bind(draftId, submissionId).all<WorkSubmissionReview>();
  return { ...summary, files, reviews };
}

export async function getWorkSubmissionWorkspace(db: D1Database, draftId: string): Promise<WorkSubmissionWorkspace> {
  const { results: versions } = await db.prepare(summarySql + ' WHERE s.draft_id=? ORDER BY s.version_number DESC')
    .bind(draftId).all<WorkSubmissionSummary>();
  const first = await db.prepare(`SELECT s.id FROM work_submission_reviews r JOIN work_submissions s ON s.id=r.submission_id
    WHERE s.draft_id=? AND r.decision='approved' ORDER BY r.id LIMIT 1`).bind(draftId).first<{ id: string }>();
  const latestFeedback = await db.prepare(reviewSql + " WHERE s.draft_id=? AND length(trim(COALESCE(r.feedback,'')))>0 ORDER BY r.id DESC LIMIT 1")
    .bind(draftId).first<WorkSubmissionReview>();
  const { results: pendingFiles } = await db.prepare(`SELECT id,filename,size,content_type AS contentType,created_at AS createdAt
    FROM work_files WHERE draft_id=? AND submission_id IS NULL AND completed_at IS NOT NULL ORDER BY created_at,id`)
    .bind(draftId).all<WorkFile>();
  const legacy = await db.prepare('SELECT admin_feedback FROM project_drafts WHERE id=?').bind(draftId).first<{ admin_feedback: string | null }>();
  return {
    draftId, review: await getWorkReviewSummary(db, draftId),
    latest: versions[0] ? await getWorkSubmissionDetail(db, draftId, versions[0].id) : null,
    firstApprovedSubmission: versions.find(v => v.id === first?.id) ?? null,
    versions, latestFeedback, pendingFiles,
    window: getWindowOrFallback(await listEventWindows(db), 'work_upload_open'),
    legacyFeedback: legacy?.admin_feedback ?? null,
  };
}

export async function createWorkSubmission(db: D1Database, participantId: string, input: CreateWorkSubmissionInput): Promise<WorkSubmissionMutationResult> {
  const parsed = createWorkSubmissionSchema.safeParse(input);
  if (!parsed.success) return fail(422, 'invalid_submission', parsed.error.issues[0].message);
  const participant = await db.prepare('SELECT status FROM participants WHERE id=?').bind(participantId).first<{ status: string }>();
  if (!participant || !['approved', 'completed'].includes(participant.status)) return fail(403, 'submission_ineligible', '报名审核通过后才能提交作品。');
  if (!getWindowOrFallback(await listEventWindows(db), 'work_upload_open').isOpen) return fail(403, 'submission_closed', '作品投稿暂未开放。');
  const draft = await getPortalProjectDraftDetail(db, participantId);
  if (!draft) return fail(404, 'project_draft_missing', '未找到作品记录。');
  const id = createPrefixedId('wsub'), now = nowIso(), data = parsed.data, ids = JSON.stringify(data.fileIds);
  const results = await db.batch([
    db.prepare(`INSERT INTO work_submissions (id,draft_id,version_number,title,work_type,summary,version_note,submitted_at)
      SELECT ?,?,COALESCE((SELECT MAX(version_number) FROM work_submissions WHERE draft_id=?),0)+1,?,?,?,?,?
      WHERE (SELECT COUNT(*) FROM work_files WHERE draft_id=? AND submission_id IS NULL AND completed_at IS NOT NULL
        AND id IN (SELECT value FROM json_each(?)))=?`)
      .bind(id,draft.id,draft.id,data.title,data.workType,data.summary,data.versionNote || null,now,draft.id,ids,data.fileIds.length),
    db.prepare(`UPDATE work_files SET submission_id=? WHERE draft_id=? AND submission_id IS NULL
      AND id IN (SELECT value FROM json_each(?)) AND EXISTS (SELECT 1 FROM work_submissions WHERE id=?)`)
      .bind(id,draft.id,ids,id),
    db.prepare(`INSERT INTO participant_events (id,participant_id,actor_type,actor_id,event_type,target_type,target_id,payload_json,created_at)
      SELECT ?,?,'participant',?,'work_submission_created','project_draft',?,'{}',? WHERE EXISTS (SELECT 1 FROM work_submissions WHERE id=?)`)
      .bind(createPrefixedId('pevt'),participantId,participantId,draft.id,now,id),
  ]);
  if (results[0].meta.changes !== 1) return fail(409, 'submission_files_changed', '请选择已完成上传、尚未提交的本人文件，刷新后重试。');
  return { ok: true, workspace: await getWorkSubmissionWorkspace(db,draft.id), message: '完整作品已提交。' };
}

export async function createWorkSubmissionReview(db: D1Database, draftId: string, submissionId: string,
  input: CreateWorkSubmissionReviewInput, reviewedBy: string): Promise<WorkSubmissionMutationResult> {
  const parsed = createWorkSubmissionReviewSchema.safeParse(input);
  if (!parsed.success) return fail(422, 'invalid_review', parsed.error.issues[0].message);
  const version = await getWorkSubmissionDetail(db,draftId,submissionId);
  if (!version) return fail(404,'submission_missing','未找到对应作品版本。');
  const draft = await db.prepare('SELECT participant_id,published_at FROM project_drafts WHERE id=?')
    .bind(draftId).first<{ participant_id: string; published_at: string | null }>();
  if (!draft) return fail(404,'project_draft_missing','未找到作品记录。');
  const data = parsed.data, now = nowIso();
  if (draft.published_at && data.decision && data.decision !== 'approved') return fail(409,'work_published','请先撤下公开作品，再调整审核状态。');
  const statements = [db.prepare(`INSERT INTO work_submission_reviews (submission_id,feedback,decision,reviewed_by,created_at)
    SELECT ?,?,?,?,? WHERE ? IS NULL OR NOT EXISTS (SELECT 1 FROM work_submissions WHERE draft_id=? AND version_number>?)`)
    .bind(submissionId,data.feedback || null,data.decision ?? null,reviewedBy,now,data.decision ?? null,draftId,version.versionNumber)];
  if (data.decision) {
    const approved = data.decision === 'approved';
    statements.push(db.prepare(`UPDATE project_drafts SET preview_status=?,review_status=?,
      preview_title=CASE WHEN ? THEN ? ELSE preview_title END, preview_summary=CASE WHEN ? THEN ? ELSE preview_summary END,
      work_type=CASE WHEN ? THEN ? ELSE work_type END,reviewed_at=?,reviewed_by=?,updated_at=?
      WHERE id=? AND changes()=1`)
      .bind(approved ? 'approved' : 'changes_requested',approved ? 'approved' : 'changes_requested',
        approved ? 1 : 0,version.title,approved ? 1 : 0,version.summary,approved ? 1 : 0,version.workType,now,reviewedBy,now,draftId));
  }
  statements.push(db.prepare(`INSERT INTO participant_events (id,participant_id,actor_type,actor_id,event_type,target_type,target_id,payload_json,created_at)
    SELECT ?,?,'admin',?,'work_submission_reviewed','project_draft',?,'{}',? WHERE changes()=1`)
    .bind(createPrefixedId('pevt'),draft.participant_id,reviewedBy,draftId,now));
  const results = await db.batch(statements);
  if (results[0].meta.changes !== 1) return fail(409,'submission_changed','作者已提交新版本，请刷新后再审核。');
  if (data.decision === 'approved') await publishConfirmedProjectIfReady(db,draftId);
  return { ok: true,workspace: await getWorkSubmissionWorkspace(db,draftId),message: '审稿意见已保存，作者现在可以查看。' };
}
