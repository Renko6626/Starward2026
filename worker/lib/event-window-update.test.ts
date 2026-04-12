import { describe, expect, it } from "vitest";
import { updateEventWindowInputSchema } from "../../src/shared/windows";

describe("updateEventWindowInputSchema", () => {
  it("accepts nullable boundaries for admin-managed windows", () => {
    const parsed = updateEventWindowInputSchema.safeParse({
      isEnabled: true,
      opensAt: null,
      closesAt: null,
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects a closing time that is not after the opening time", () => {
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
