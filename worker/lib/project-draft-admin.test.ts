import { describe, expect, it } from "vitest";

describe("resolveAdminProjectDraftReviewUpdate", () => {
  it("normalizes blank admin feedback and keeps review metadata when nothing changed", async () => {
    const module = await import("./project-draft-admin").catch(() => null);

    expect(module).not.toBeNull();

    if (!module) {
      return;
    }

    expect(
      module.resolveAdminProjectDraftReviewUpdate({
        currentPreviewStatus: "submitted",
        currentReviewStatus: "draft",
        currentAdminFeedback: null,
        currentReviewedAt: "2026-04-10T12:00:00.000Z",
        currentReviewedBy: "admin_old",
        nextPreviewStatus: "submitted",
        nextReviewStatus: "draft",
        nextAdminFeedback: "   ",
        reviewerId: "admin_new",
        now: "2026-04-11T12:00:00.000Z",
      }),
    ).toMatchObject({
      nextAdminFeedback: null,
      reviewedAt: "2026-04-10T12:00:00.000Z",
      reviewedBy: "admin_old",
      hasChanges: false,
    });
  });

  it("refreshes review metadata when a status changes", async () => {
    const { resolveAdminProjectDraftReviewUpdate } = await import("./project-draft-admin");

    expect(
      resolveAdminProjectDraftReviewUpdate({
        currentPreviewStatus: "submitted",
        currentReviewStatus: "submitted",
        currentAdminFeedback: "请补一版更明确的说明。",
        currentReviewedAt: "2026-04-10T12:00:00.000Z",
        currentReviewedBy: "admin_old",
        nextPreviewStatus: "approved",
        nextReviewStatus: "submitted",
        nextAdminFeedback: "请补一版更明确的说明。",
        reviewerId: "admin_new",
        now: "2026-04-11T12:00:00.000Z",
      }),
    ).toMatchObject({
      nextPreviewStatus: "approved",
      reviewedAt: "2026-04-11T12:00:00.000Z",
      reviewedBy: "admin_new",
      hasChanges: true,
    });
  });

  it("refreshes review metadata when only admin feedback changes", async () => {
    const { resolveAdminProjectDraftReviewUpdate } = await import("./project-draft-admin");

    expect(
      resolveAdminProjectDraftReviewUpdate({
        currentPreviewStatus: "draft",
        currentReviewStatus: "submitted",
        currentAdminFeedback: null,
        currentReviewedAt: null,
        currentReviewedBy: null,
        nextPreviewStatus: "draft",
        nextReviewStatus: "submitted",
        nextAdminFeedback: "建议把内容警示再写具体一点。",
        reviewerId: "admin_02",
        now: "2026-04-11T12:00:00.000Z",
      }),
    ).toMatchObject({
      nextAdminFeedback: "建议把内容警示再写具体一点。",
      reviewedAt: "2026-04-11T12:00:00.000Z",
      reviewedBy: "admin_02",
      hasChanges: true,
    });
  });
});
