import { describe, expect, it } from "vitest";

describe("buildPortalEventLabel", () => {
  it("describes a claimed segment using payload metadata", async () => {
    const module = await import("./portal-history").catch(() => null);

    expect(module).not.toBeNull();

    if (!module) {
      return;
    }

    expect(
      module.buildPortalEventLabel({
        eventType: "segment_claimed",
        actorType: "participant",
        payloadJson: JSON.stringify({
          segmentCode: "SEG-03",
          segmentName: "第三时段",
        }),
      }),
    ).toBe("已认领时间段 SEG-03 · 第三时段。");
  });

  it("describes a changed segment using from/to payload metadata", async () => {
    const { buildPortalEventLabel } = await import("./portal-history");

    expect(
      buildPortalEventLabel({
        eventType: "segment_changed",
        actorType: "participant",
        payloadJson: JSON.stringify({
          fromSegmentCode: "SEG-01",
          fromSegmentName: "第一时段",
          toSegmentCode: "SEG-02",
          toSegmentName: "第二时段",
        }),
      }),
    ).toBe("已将时间段从 SEG-01 · 第一时段 调整为 SEG-02 · 第二时段。");
  });

  it("falls back to a generic admin-review label when payload details are not needed", async () => {
    const { buildPortalEventLabel } = await import("./portal-history");

    expect(
      buildPortalEventLabel({
        eventType: "project_draft_admin_reviewed",
        actorType: "admin",
        payloadJson: null,
      }),
    ).toBe("主催更新了你的资料审核结果。");
  });
});

describe("buildPortalEventActorLabel", () => {
  it("maps actor types to short UI labels", async () => {
    const { buildPortalEventActorLabel } = await import("./portal-history");

    expect(buildPortalEventActorLabel("participant")).toBe("你");
    expect(buildPortalEventActorLabel("admin")).toBe("主催");
    expect(buildPortalEventActorLabel("system")).toBe("系统");
  });
});
