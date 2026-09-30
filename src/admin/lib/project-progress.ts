import type { AdminProjectDraftItem } from "../../shared/admin";

export function summarizeProjectProgress(
  items: Pick<AdminProjectDraftItem, "previewStatus" | "reviewStatus">[],
) {
  let drafts = 0;
  let submitted = 0;
  for (const item of items) {
    const statuses = [item.previewStatus, item.reviewStatus];
    if (statuses.some((status) => ["submitted", "changes_requested", "approved"].includes(status))) {
      submitted++;
    } else if (statuses.includes("draft")) {
      drafts++;
    }
  }
  return { drafts, submitted };
}
