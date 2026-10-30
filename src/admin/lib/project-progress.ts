import type { WorkReviewSummary, WorkSubmissionSummary } from '../../shared/work-submissions';
export function summarizeProjectProgress(items: {review:WorkReviewSummary}[]) {
  return {drafts:items.filter(item => item.review.status === 'not_submitted').length,
    submitted:items.filter(item => item.review.status !== 'not_submitted').length};
}

export function matchesProjectScope(item: {review: WorkReviewSummary; latestSubmission: Pick<WorkSubmissionSummary, 'id'> | null}, scope: string) {
  if (scope === 'unapproved') return item.latestSubmission !== null && item.review.status !== 'approved';
  if (scope === 'all') return true;
  if (scope === 'updated') return item.review.hasUpdatesAfterReview;
  return item.review.status === scope.replaceAll('-', '_');
}
