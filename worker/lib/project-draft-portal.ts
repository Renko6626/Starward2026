import type { ProjectDraftStatus } from "../../src/shared/portal";
import { normalizeOptionalText } from "./strings";

export function resolvePortalProjectDraftSaveStatus(
  currentStatus: ProjectDraftStatus,
): ProjectDraftStatus {
  if (currentStatus === "changes_requested" || currentStatus === "approved") {
    return currentStatus;
  }

  return "draft";
}

export function collectMissingPreviewSubmissionFields(input: {
  previewTitle: string | null;
  previewSummary: string | null;
  publicAuthorName: string | null;
  formatLabel: string | null;
}) {
  return [
    [normalizeOptionalText(input.previewTitle), "预告标题"],
    [normalizeOptionalText(input.previewSummary), "预告简介"],
    [normalizeOptionalText(input.publicAuthorName), "个人档案署名"],
    [normalizeOptionalText(input.formatLabel), "作品形式"],
  ]
    .filter(([value]) => !value)
    .map(([, label]) => label);
}

export function collectMissingReviewSubmissionFields(input: {
  contentNote: string | null;
  contentWarnings: string | null;
}) {
  return [
    [normalizeOptionalText(input.contentNote), "内容概述"],
    [normalizeOptionalText(input.contentWarnings), "内容警示"],
  ]
    .filter(([value]) => !value)
    .map(([, label]) => label);
}
