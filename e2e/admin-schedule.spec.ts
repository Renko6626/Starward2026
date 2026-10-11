import type { Page } from "@playwright/test";
import { test, expect, openPortal, rows, seed, openChapter } from "./fixtures";

async function createSeat(page: Page, kind: "standard" | "special", name: string, time: string) {
  await page.goto("/portal/admin/schedule");
  await page.locator("summary").filter({ hasText: "新增发布时间" }).click();
  const form = page.locator("details").filter({ has: page.locator("summary", { hasText: "新增发布时间" }) });
  await form.getByLabel("席位类型").selectOption(kind);
  await form.getByLabel("名称", { exact: true }).fill(name);
  await form.getByLabel("发布时间（北京时间）").fill(time);
  await form.getByRole("button", { name: "新增发布时间", exact: true }).click();
  const row = page.locator(".admin-segment-row").filter({ hasText: name });
  await expect(row).toBeVisible();
  return row;
}

async function approvePending(page: Page) {
  await page.goto("/portal/admin/participants?view=pending");
  await page.getByRole("row").filter({ hasText: "宇佐见莲子" }).getByRole("link", { name: "查看详情" }).click();
  await page.getByRole("button", { name: "批准报名", exact: true }).click();
  await expect.poll(() => rows("SELECT status FROM applications WHERE id = 'app_seed_portal_pending'"))
    .toEqual([{ status: "approved" }]);
}

test("批准未排期报名后从参与者详情分配席位", async ({ adminPage, pendingPage }) => {
  await approvePending(adminPage);
  await openPortal(pendingPage);
  await expect(pendingPage.getByRole("region", { name: "报名进度" }).getByRole("definition").filter({ hasText: /^报名已通过$/ })).toBeVisible();
  await expect(pendingPage.locator("#relay")).toContainText("由主催安排");
  await adminPage.getByLabel("分配席位").selectOption("seg_seed_101");
  await adminPage.getByRole("button", { name: "分配发布时间", exact: true }).click();
  await expect.poll(() => rows("SELECT segment_id FROM project_drafts WHERE id = 'draft_seed_pending'"))
    .toEqual([{ segment_id: "seg_seed_101" }]);
  await pendingPage.reload();
  await expect(pendingPage.locator("#relay")).toContainText("00:00");
});

test("修改开始时间并插入半小时时点，前后棒按实际时间排列", async ({ adminPage, approvedPage, page }) => {
  await adminPage.goto("/portal/admin/schedule");
  const first = adminPage.locator(".admin-segment-row").filter({ has: adminPage.locator("summary", { hasText: "第 1 段" }) });
  await first.locator("summary").click();
  await first.getByLabel("发布时间（北京时间）").fill("2026-11-12T00:30");
  await first.getByRole("button", { name: "保存修正" }).click();
  await expect.poll(() => rows("SELECT scheduled_at FROM schedule_segments WHERE id = 'seg_seed_101'"))
    .toEqual([{ scheduled_at: "2026-11-11T16:30:00.000Z" }]);
  await createSeat(adminPage, "standard", "E2E 半小时插入", "2026-11-12T00:45");
  await openPortal(approvedPage);
  const previous = approvedPage.locator(".neighbor-card").filter({ hasText: "前一棒" });
  await expect(previous).toContainText("E2E 半小时插入");
  await expect(previous).toContainText("00:45");
  await page.goto("/works");
  await expect(page.getByRole("heading", { name: "接力时间表" })).toBeVisible();
  await expect(page.locator("button.ops-task").first()).toBeVisible();
  const times = page.locator("button.ops-task time");
  await expect(times).toHaveCount(25);
  expect(await times.evaluateAll(elements => elements.map(element => element.getAttribute("datetime"))))
    .toEqual((await rows("SELECT scheduled_at FROM schedule_segments ORDER BY scheduled_at")).map(row => row.scheduled_at));
});

test("排期页分配特别席位，公开及报名列表隐藏，相邻作者可申请换期", async ({ adminPage, pendingPage, approvedPage, page }) => {
  test.setTimeout(120_000);
  await approvePending(adminPage);
  const row = await createSeat(adminPage, "special", "E2E 特别席位", "2026-11-12T01:30");
  await row.locator("summary").click();
  await row.getByLabel("状态").selectOption("held");
  await row.getByLabel("认领人").selectOption("part_seed_pending");
  await row.getByRole("button", { name: "保存修正" }).click();
  await expect.poll(() => rows("SELECT current_participant_id FROM schedule_segments WHERE kind = 'special'"))
    .toEqual([{ current_participant_id: "part_seed_pending" }]);
  await openPortal(pendingPage);
  await expect(pendingPage.getByRole("region", { name: "报名进度" })).toContainText("特别席位");
  await page.goto("/works");
  await expect(page.locator("button.ops-task")).toHaveCount(24);
  const publicData = await (await page.request.get("/api/works")).text();
  expect(publicData).not.toContain("E2E 特别席位");
  await page.close();
  const foreign = await (await approvedPage.request.get("/api/portal/collaboration")).json();
  expect(foreign.segments.every((seat: { kind: string }) => seat.kind !== "special")).toBe(true);
  await openPortal(approvedPage);
  const next = approvedPage.locator(".neighbor-card").filter({ hasText: "后一棒" });
  await expect(next).toContainText("E2E 特别席位");
  await next.getByRole("button", { name: "申请与这一棒换期" }).click();
  await expect.poll(() => rows("SELECT status FROM segment_swap_requests")).toEqual([{ status: "pending" }]);
  await pendingPage.reload();
  await pendingPage.getByRole("button", { name: "同意交换" }).click();
  await expect.poll(() => rows("SELECT status FROM segment_swap_requests")).toEqual([{ status: "accepted" }]);
  await openPortal(approvedPage);
  await expect(approvedPage.getByRole("region", { name: "报名进度" })).toContainText("特别席位");
  await approvedPage.getByRole("button", { name: "确认释放当前发布时点" }).click();
  await expect.poll(() => rows("SELECT current_participant_id FROM schedule_segments WHERE kind = 'special'"))
    .toEqual([{ current_participant_id: null }]);
  // Return the other author to pending to inspect actual registration choices.
  await seed("UPDATE participants SET status = 'pending' WHERE id = 'part_seed_pending'; UPDATE applications SET status = 'pending' WHERE id = 'app_seed_portal_pending';");
  await pendingPage.reload();
  await openChapter(pendingPage, "plan");
  await expect(pendingPage.locator('[name="segmentId"]')).not.toContainText("E2E 特别席位");
});

for (const status of ["locked", "completed"] as const) {
  test(`${status} 席位保留归属并阻止作者释放和改期`, async ({ adminPage, approvedPage }) => {
    await adminPage.goto("/portal/admin/schedule");
    const row = adminPage.locator(".admin-segment-row").filter({ has: adminPage.locator("summary", { hasText: "第 2 段" }) });
    await row.locator("summary").click();
    await row.getByLabel("状态").selectOption(status);
    await row.getByRole("button", { name: "保存修正" }).click();
    await expect.poll(() => rows("SELECT status FROM schedule_segments WHERE id = 'seg_seed_102'"))
      .toEqual([{ status }]);
    await openPortal(approvedPage);
    await expect(approvedPage.getByRole("region", { name: "报名进度" })).toContainText(status === "locked" ? "已锁定" : "已完成");
    await expect(approvedPage.getByRole("button", { name: "确认释放当前发布时点" })).toHaveCount(0);
    for (const endpoint of ["release", "change"]) {
      const response = await approvedPage.request.post(`/api/portal/segments/${endpoint}`, { data: { segmentId: "seg_seed_101" } });
      expect(response.ok()).toBe(false);
    }
    expect(await rows("SELECT current_participant_id FROM schedule_segments WHERE id = 'seg_seed_102'"))
      .toEqual([{ current_participant_id: "part_seed_active" }]);
    expect(await rows("SELECT segment_id FROM project_drafts WHERE id = 'draft_seed_active'"))
      .toEqual([{ segment_id: "seg_seed_102" }]);
  });
}
