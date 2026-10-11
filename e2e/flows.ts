import type { Page } from "@playwright/test";
import { expect, openChapter, openPortal, rows, seed } from "./fixtures";

export async function registerAndApply(page: Page) {
  await page.goto("/portal/login");
  await page.getByLabel("邮箱", { exact: true }).fill("e2e-new@example.com");
  await page.getByLabel("密码", { exact: true }).fill("e2e-password-2026");
  await expect(page.getByRole("button", { name: "注册并进入", exact: true })).toBeDisabled();
  await page.getByLabel(/我已阅读并同意/).check();
  await page.getByRole("button", { name: "注册并进入", exact: true }).click();
  await expect(page.getByRole("heading", { name: "作者档案" })).toBeVisible();
  await page.getByRole("button", { name: "提交报名", exact: true }).click();
  await expect(page.locator('[name="profile.creditName"]')).toHaveAttribute("aria-invalid", "true");
  await page.locator('[name="profile.creditName"]').fill("E2E 新作者");
  await page.locator('[name="profile.bilibiliUid"]').fill("202600088");
  await page.locator('[name="profile.primaryContactHandle"]').fill("123456789");
  await openChapter(page, "plan");
  await page.locator('[name="application.introText"]').fill("准备创作一篇关于秘封旅行的小说。");
  await expect(page.locator('[name="segmentId"]')).toHaveValue("");
  await page.getByRole("button", { name: "提交报名", exact: true }).click();
  await expect(page.getByRole("region", { name: "报名进度" }).getByRole("definition").filter({ hasText: /^报名待审核$/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "报名进度" }).getByRole("definition").filter({ hasText: /^报名待审核$/ })).toBeVisible();
  await openChapter(page, "plan");
  await expect(page.locator('[name="application.introText"]')).toHaveValue("准备创作一篇关于秘封旅行的小说。");
  expect(await rows("SELECT segment_id FROM project_drafts JOIN participants ON participants.id = project_drafts.participant_id JOIN user ON user.id = participants.user_id WHERE user.email = 'e2e-new@example.com'"))
    .toEqual([{ segment_id: null }]);
  await page.getByRole("button", { name: "退出登录" }).click();
  await page.goto("/portal/login");
  await page.getByRole("button", { name: "密码登录", exact: true }).click();
  await page.getByLabel("邮箱", { exact: true }).fill("e2e-new@example.com");
  await page.getByLabel("密码", { exact: true }).fill("e2e-password-2026");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("heading", { name: "作者档案" })).toBeVisible();
}

export async function fillAllSeats() {
  await seed(`INSERT INTO participants (id,status,created_at,updated_at)
    SELECT 'full_' || id, 'approved', created_at, updated_at FROM schedule_segments WHERE current_participant_id IS NULL;
    UPDATE schedule_segments SET status = 'held', current_participant_id = 'full_' || id WHERE current_participant_id IS NULL;`);
}

export async function swapAuthors(approvedPage: Page, pendingPage: Page) {
  await approvedPage.goto("/works");
  await approvedPage.locator('button.ops-task').filter({ has: approvedPage.locator('time[datetime="2026-11-11T16:00:00.000Z"]') }).click();
  // Desktop uses its inline detail; mobile opens the same actions in a dialog.
  await approvedPage.getByRole("button", { name: "发送换期请求" }).click();
  await expect.poll(() => rows("SELECT status FROM segment_swap_requests")).toEqual([{ status: "pending" }]);
  expect(await rows("SELECT current_participant_id FROM schedule_segments WHERE id = 'seg_seed_102'"))
    .toEqual([{ current_participant_id: "part_seed_active" }]);
  await openPortal(pendingPage);
  await pendingPage.getByRole("button", { name: "同意交换" }).click();
  await expect.poll(() => rows("SELECT status FROM segment_swap_requests")).toEqual([{ status: "accepted" }]);
  await openPortal(approvedPage);
  await expect(approvedPage.getByRole("region", { name: "报名进度" })).toContainText("00:00");
  await pendingPage.reload();
  await expect(pendingPage.getByRole("region", { name: "报名进度" })).toContainText("01:00");
  expect(await rows("SELECT participant_id, segment_id FROM project_drafts ORDER BY participant_id")).toEqual([
    { participant_id: "part_seed_active", segment_id: "seg_seed_101" },
    { participant_id: "part_seed_pending", segment_id: "seg_seed_102" },
  ]);
}
