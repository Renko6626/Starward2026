import { test, expect, openPortal, openChapter, rows } from "./fixtures";
import { fillAllSeats, registerAndApply } from "./flows";

test("新作者注册、必填校验、满额报名、退出和密码登录", async ({ page }) => {
  await fillAllSeats();
  await registerAndApply(page);
});

test("24 个席位全部占用后仍可提交未排期报名", async ({ pendingPage }) => {
  await fillAllSeats();
  await openPortal(pendingPage);
  await openChapter(pendingPage, "plan");
  await expect(pendingPage.locator('select[name="segmentId"] option')).toHaveCount(1);
  await expect(pendingPage.getByText("当前没有可选时间，仍可提交报名，由主催安排。")).toBeVisible();
  await pendingPage.getByRole("button", { name: "更新报名", exact: true }).click();
  await expect(pendingPage.getByText("已提交报名，等待主催审核并安排发布时间。", { exact: true })).toBeVisible();
  await pendingPage.reload();
  await expect(pendingPage.getByRole("region", { name: "报名进度" }).getByRole("definition").filter({ hasText: /^报名待审核$/ })).toBeVisible();
  expect(await rows("SELECT segment_id FROM project_drafts WHERE participant_id = 'part_seed_pending'"))
    .toEqual([{ segment_id: null }]);
  expect(await rows("SELECT count(*) AS count FROM schedule_segments WHERE current_participant_id IS NOT NULL")).toEqual([{ count: 24 }]);
});

test("报名预留时间后可以撤回，时间重新开放", async ({ pendingPage }) => {
  await openPortal(pendingPage);
  await openChapter(pendingPage, "plan");
  await pendingPage.locator('[name="segmentId"]').selectOption("seg_seed_101");
  await pendingPage.getByRole("button", { name: "更新报名", exact: true }).click();
  await expect(pendingPage.getByText("已提交报名并预留时段，等待主催审核。", { exact: true })).toBeVisible();
  await pendingPage.getByRole("button", { name: "撤回报名", exact: true }).click();
  await pendingPage.getByRole("button", { name: "确认撤回", exact: true }).click();
  await expect(pendingPage.getByRole("region", { name: "报名进度" }).getByRole("definition").filter({ hasText: /^已撤回$/ })).toBeVisible();
  expect(await rows("SELECT current_participant_id FROM schedule_segments WHERE id = 'seg_seed_101'"))
    .toEqual([{ current_participant_id: null }]);
});
