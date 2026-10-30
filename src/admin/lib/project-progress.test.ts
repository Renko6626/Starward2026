import { expect,it } from 'vitest';
import { matchesProjectScope, summarizeProjectProgress } from './project-progress';
import { summarizeWorkReview } from '../../shared/work-submissions';
it('counts only formally submitted works', () => {
  expect(summarizeProjectProgress([{review:summarizeWorkReview(null,null)}, {review:summarizeWorkReview(1,null)},
    {review:summarizeWorkReview(2,{submissionId:'v1',versionNumber:1,decision:'approved'})}])).toEqual({drafts:1,submitted:2});
});

it('prioritizes submitted works without approval, excluding drafts and approved revisions', () => {
  const submitted = { latestSubmission: { id: 'v1' }, review: summarizeWorkReview(1, null) };
  expect(matchesProjectScope(submitted, 'unapproved')).toBe(true);
  for (const decision of ['changes_requested', 'rejected'] as const) {
    expect(matchesProjectScope({ ...submitted, review: summarizeWorkReview(1, { submissionId: 'v1', versionNumber: 1, decision }) }, 'unapproved')).toBe(true);
  }
  expect(matchesProjectScope({ latestSubmission: null, review: summarizeWorkReview(null, null) }, 'unapproved')).toBe(false);
  expect(matchesProjectScope({ ...submitted, review: summarizeWorkReview(2, { submissionId: 'v1', versionNumber: 1, decision: 'approved' }) }, 'unapproved')).toBe(false);
  expect(matchesProjectScope(submitted, 'all')).toBe(true);
});
