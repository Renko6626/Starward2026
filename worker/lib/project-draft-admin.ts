import type { ProjectDraftStatus } from "../../src/shared/portal";
import { normalizeOptionalText } from "./strings";

export type ResolvedAdminProjectDraftReviewUpdate = {
  nextPreviewStatus: ProjectDraftStatus;
  nextReviewStatus: ProjectDraftStatus;
  nextAdminFeedback: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  hasChanges: boolean;
};

export function resolveAdminProjectDraftReviewUpdate(input: {
  currentPreviewStatus: ProjectDraftStatus;
  currentReviewStatus: ProjectDraftStatus;
  currentAdminFeedback: string | null;
  currentReviewedAt: string | null;
  currentReviewedBy: string | null;
  nextPreviewStatus: ProjectDraftStatus;
  nextReviewStatus: ProjectDraftStatus;
  nextAdminFeedback: string | null | undefined;
  reviewerId: string;
  now: string;
}): ResolvedAdminProjectDraftReviewUpdate {
  const nextAdminFeedback = normalizeOptionalText(input.nextAdminFeedback);
  const hasChanges =
    input.currentPreviewStatus !== input.nextPreviewStatus ||
    input.currentReviewStatus !== input.nextReviewStatus ||
    input.currentAdminFeedback !== nextAdminFeedback;

  if (!hasChanges) {
    return {
      nextPreviewStatus: input.nextPreviewStatus,
      nextReviewStatus: input.nextReviewStatus,
      nextAdminFeedback,
      reviewedAt: input.currentReviewedAt,
      reviewedBy: input.currentReviewedBy,
      hasChanges: false,
    };
  }

  return {
    nextPreviewStatus: input.nextPreviewStatus,
    nextReviewStatus: input.nextReviewStatus,
    nextAdminFeedback,
    reviewedAt: input.now,
    reviewedBy: input.reviewerId,
    hasChanges: true,
  };
}
