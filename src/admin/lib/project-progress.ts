import type { WorkReviewSummary } from '../../shared/work-submissions';
export function summarizeProjectProgress(items: {review:WorkReviewSummary}[]) {
  return {drafts:items.filter(item => item.review.status === 'not_submitted').length,
    submitted:items.filter(item => item.review.status !== 'not_submitted').length};
}
