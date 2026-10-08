import { describe, expect, it } from "vitest";
import { parseRegistrationDraft } from "./registration-draft";
import { scheduleSelectionSearch } from "./schedule-selection";

describe("registration draft", () => {
  const incomplete = {
    profile: { creditName: "未完成署名", bilibiliUid: "", contactEmail: "unfinished@", primaryContactChannel: "Email", primaryContactHandle: "", isAnonymous: true },
    application: { contactEmail: "", interestFormat: "novel", introText: "写到一半的创作计划" },
    segmentId: "slot-14",
  };

  it("retains incomplete information and the chosen time across page visits", () => {
    expect(parseRegistrationDraft(JSON.stringify(incomplete))).toEqual(incomplete);
  });

  it("ignores missing, damaged or incompatible drafts", () => {
    expect(parseRegistrationDraft(null)).toBeNull();
    expect(parseRegistrationDraft("{broken")).toBeNull();
    expect(parseRegistrationDraft(JSON.stringify({ ...incomplete, profile: { ...incomplete.profile, isAnonymous: "yes" } }))).toBeNull();
  });
});

describe("schedule selection through login", () => {
  it("keeps the chosen slot without carrying unrelated query data", () => {
    expect(scheduleSelectionSearch({ segment: "slot-14", next: "https://example.com" })).toEqual({ segment: "slot-14" });
  });

  it("ignores malformed slot identifiers", () => {
    expect(scheduleSelectionSearch({ segment: ["slot-14"] }).segment).toBeUndefined();
    expect(scheduleSelectionSearch({ segment: "x".repeat(65) }).segment).toBeUndefined();
  });
});
