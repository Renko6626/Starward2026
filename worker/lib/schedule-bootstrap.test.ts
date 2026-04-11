import { describe, expect, it } from "vitest";

describe("buildInitialScheduleSegments", () => {
  it("builds zero-padded open segments for the requested count", async () => {
    const module = await import("./schedule-bootstrap").catch(() => null);

    expect(module).not.toBeNull();

    if (!module) {
      return;
    }

    expect(typeof module.buildInitialScheduleSegments).toBe("function");

    const items = module.buildInitialScheduleSegments(5);

    expect(items).toEqual([
      {
        code: "01",
        name: "第 1 段",
        description: null,
        status: "open",
        sortOrder: 1,
      },
      {
        code: "02",
        name: "第 2 段",
        description: null,
        status: "open",
        sortOrder: 2,
      },
      {
        code: "03",
        name: "第 3 段",
        description: null,
        status: "open",
        sortOrder: 3,
      },
      {
        code: "04",
        name: "第 4 段",
        description: null,
        status: "open",
        sortOrder: 4,
      },
      {
        code: "05",
        name: "第 5 段",
        description: null,
        status: "open",
        sortOrder: 5,
      },
    ]);
  });

  it("expands the code width when the segment count reaches three digits", async () => {
    const { buildInitialScheduleSegments } = await import("./schedule-bootstrap");

    const items = buildInitialScheduleSegments(120);

    expect(items[0]).toMatchObject({
      code: "001",
      name: "第 1 段",
      sortOrder: 1,
    });
    expect(items.at(-1)).toMatchObject({
      code: "120",
      name: "第 120 段",
      sortOrder: 120,
    });
  });
});
