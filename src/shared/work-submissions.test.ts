import { describe, expect, it } from 'vitest';
import { createWorkSubmissionSchema, createWorkSubmissionReviewSchema, summarizeWorkReview } from './work-submissions';

describe('complete submission contracts', () => {
  it('keeps approval on later revisions but requires review after a returned revision', () => {
    expect(summarizeWorkReview(null, null).status).toBe('not_submitted');
    expect(summarizeWorkReview(1, null).status).toBe('pending');
    expect(summarizeWorkReview(2, { submissionId: 'v1', versionNumber: 1, decision: 'approved' }))
      .toEqual({ status: 'approved', decisionSubmissionId: 'v1', decisionVersionNumber: 1, hasUpdatesAfterReview: true });
    expect(summarizeWorkReview(3, { submissionId: 'v2', versionNumber: 2, decision: 'changes_requested' }).status).toBe('pending');
    expect(summarizeWorkReview(2, { submissionId: 'v2', versionNumber: 2, decision: 'rejected' }).status).toBe('rejected');
  });
  it('requires a complete file selection and a reason for negative decisions', () => {
    const input = { title: '作品', workType: 'text', summary: '简介', fileIds: ['a'] };
    expect(createWorkSubmissionSchema.safeParse(input).success).toBe(true);
    expect(createWorkSubmissionSchema.safeParse({ ...input, fileIds: [] }).success).toBe(false);
    expect(createWorkSubmissionSchema.safeParse({ ...input, fileIds: ['a', 'a'] }).success).toBe(false);
    expect(createWorkSubmissionReviewSchema.safeParse({ feedback: '  ' }).success).toBe(false);
    expect(createWorkSubmissionReviewSchema.safeParse({ decision: 'rejected', feedback: '' }).success).toBe(false);
    expect(createWorkSubmissionReviewSchema.safeParse({ decision: 'approved' }).success).toBe(true);
    expect(createWorkSubmissionReviewSchema.safeParse({ feedback: '请注意字幕' }).success).toBe(true);
  });
});
