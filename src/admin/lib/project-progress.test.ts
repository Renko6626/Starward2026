import { describe, expect, it } from "vitest";
import { summarizeProjectProgress } from "./project-progress";

describe("summarizeProjectProgress", () => {
  it("separates draft-only work from submitted work", () => {
    expect(
      summarizeProjectProgress([
        { previewStatus: "not_started", reviewStatus: "not_started" },
        { previewStatus: "draft", reviewStatus: "draft" },
        { previewStatus: "submitted", reviewStatus: "draft" },
        { previewStatus: "changes_requested", reviewStatus: "not_started" },
        { previewStatus: "approved", reviewStatus: "approved" },
      ]),
    ).toEqual({ drafts: 1, submitted: 3 });
  });
});
