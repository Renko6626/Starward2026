import { expect, it } from 'vitest';
import type { WorkSubmissionDetail, WorkSubmissionWorkspace } from '../../shared/work-submissions';
import { summarizeWorkReview } from '../../shared/work-submissions';
import { buildSubmissionNotice, submissionNoticeStorageKey } from './submission-notice';

const version: WorkSubmissionDetail = {
  id: 'version-1', versionNumber: 1, title: '作品', workType: 'text', summary: '简介',
  versionNote: null, submittedAt: '2026-10-31', fileCount: 1, files: [], reviews: [],
};
function workspace(patch: Partial<WorkSubmissionWorkspace> = {}): WorkSubmissionWorkspace {
  return { draftId: 'work-1', review: summarizeWorkReview(null, null), latest: null,
    firstApprovedSubmission: null, versions: [], latestFeedback: null, pendingFiles: [], legacyFeedback: null,
    window: { key: 'work_upload_open', label: '作品投稿', isEnabled: true, isOpen: true, state: 'open', opensAt: null, closesAt: null, updatedAt: '' }, ...patch };
}

it('explains formal submission without treating a temporary upload as a new notice', () => {
  const first = buildSubmissionNotice(workspace())!;
  expect(first.status).toBe('not_submitted');
  expect(first.steps).toContain('上传完整文件后，点击“提交完整作品”，才算正式交稿。');
  expect(buildSubmissionNotice(workspace({ pendingFiles: [{ id: 'f', filename: '作品.pdf', size: 3, contentType: '', createdAt: '' }] }))?.id).toBe(first.id);
  const closed = workspace(); closed.window.isOpen = false;
  expect(buildSubmissionNotice(closed)?.primaryLabel).toBe('查看投稿安排');
});

it('identifies waiting notices by the submitted version', () => {
  const first = buildSubmissionNotice(workspace({ latest: version, review: summarizeWorkReview(1, null) }))!;
  expect(first.status).toBe('pending');
  const next = buildSubmissionNotice(workspace({ latest: { ...version, id: 'version-2', versionNumber: 2 }, review: summarizeWorkReview(2, null) }))!;
  expect(next.id).not.toBe(first.id);
  expect(next.description).toContain('V2');
});

it('shows the decision reason and distinguishes new negative decisions from ordinary comments', () => {
  const decision = { id: 7, submissionId: version.id, versionNumber: 1, decision: 'changes_requested' as const, feedback: '请修改结尾', createdAt: '2026-10-31' };
  const work = workspace({ latest: { ...version, reviews: [{ ...decision, id: 8, decision: null, feedback: '补充建议' }, decision] },
    review: summarizeWorkReview(1, { ...decision, decision: 'changes_requested' }) });
  const notice = buildSubmissionNotice(work)!;
  expect(notice.feedback).toBe('请修改结尾');
  expect(buildSubmissionNotice({ ...work, latest: { ...version, reviews: [decision] } })?.id).toBe(notice.id);
  expect(buildSubmissionNotice({ ...work, latest: { ...version, reviews: [{ ...decision, id: 9 }] } })?.id).not.toBe(notice.id);
  expect(buildSubmissionNotice({ ...work, latest: { ...version, reviews: [{ ...decision, decision: 'rejected' }] }, review: summarizeWorkReview(1, { ...decision, decision: 'rejected' }) })?.status).toBe('rejected');
});

it('announces first approval once even when later complete revisions are submitted', () => {
  const review = summarizeWorkReview(1, { submissionId: version.id, versionNumber: 1, decision: 'approved' });
  const work = workspace({ latest: version, firstApprovedSubmission: version, review });
  const first = buildSubmissionNotice(work)!;
  expect(first.status).toBe('approved');
  expect(first.description).toContain('V1');
  expect(buildSubmissionNotice({ ...work, latest: { ...version, id: 'version-2', versionNumber: 2 },
    review: summarizeWorkReview(2, { submissionId: version.id, versionNumber: 1, decision: 'approved' }) })?.id).toBe(first.id);
});

it('separates browser read receipts by account, work and notification', () => {
  const key = submissionNoticeStorageKey('author-1', 'work-1', 'first-approval');
  expect(submissionNoticeStorageKey('author-2', 'work-1', 'first-approval')).not.toBe(key);
  expect(submissionNoticeStorageKey('author-1', 'work-2', 'first-approval')).not.toBe(key);
  expect(submissionNoticeStorageKey('author-1', 'work-1', 'pending')).not.toBe(key);
});
