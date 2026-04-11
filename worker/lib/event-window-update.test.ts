import { describe, expect, it } from "vitest";

describe("updateEventWindowInputSchema", () => {
  it("accepts nullable boundaries for admin-managed windows", async () => {
    const module = await import("../../src/shared/windows").catch(() => null);

    expect(module).not.toBeNull();

    if (!module || !("updateEventWindowInputSchema" in module)) {
      return;
    }

    const parsed = module.updateEventWindowInputSchema.safeParse({
      isEnabled: true,
      opensAt: null,
      closesAt: null,
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects a closing time that is not after the opening time", async () => {
    const { updateEventWindowInputSchema } = await import("../../src/shared/windows");

    const parsed = updateEventWindowInputSchema.safeParse({
      isEnabled: true,
      opensAt: "2026-04-11T10:00:00.000Z",
      closesAt: "2026-04-11T10:00:00.000Z",
    });

    expect(parsed.success).toBe(false);

    if (parsed.success) {
      return;
    }

    expect(parsed.error.issues[0]?.message).toContain("结束时间");
  });
});
