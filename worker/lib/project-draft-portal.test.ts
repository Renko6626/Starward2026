import { describe, expect, it } from "vitest";

describe("resolvePortalProjectDraftSaveStatus", () => {
  it("returns draft for fresh or previously submitted preview/review saves", async () => {
    const module = await import("./project-draft-portal").catch(() => null);

    expect(module).not.toBeNull();

    if (!module) {
      return;
    }

    expect(module.resolvePortalProjectDraftSaveStatus("not_started")).toBe("draft");
    expect(module.resolvePortalProjectDraftSaveStatus("submitted")).toBe("draft");
    expect(module.resolvePortalProjectDraftSaveStatus("approved")).toBe("approved");
  });

  it("keeps changes_requested until the participant explicitly resubmits", async () => {
    const { resolvePortalProjectDraftSaveStatus } = await import("./project-draft-portal");

    expect(resolvePortalProjectDraftSaveStatus("changes_requested")).toBe("changes_requested");
  });
});

describe("collectMissingPreviewSubmissionFields", () => {
  it("lists the required preview fields that are still missing", async () => {
    const { collectMissingPreviewSubmissionFields } = await import("./project-draft-portal");

    expect(
      collectMissingPreviewSubmissionFields({
        previewTitle: "  ",
        previewSummary: "",
        publicAuthorName: "示例作者",
        formatLabel: null,
      }),
    ).toEqual(["作品标题", "作品简介", "作品形式"]);
  });
});

describe("collectMissingReviewSubmissionFields", () => {
  it("lists the required review fields that are still missing", async () => {
    const { collectMissingReviewSubmissionFields } = await import("./project-draft-portal");

    expect(
      collectMissingReviewSubmissionFields({
        contentNote: "  ",
        contentWarnings: null,
      }),
    ).toEqual(["内容概述", "内容提醒"]);
  });
});
