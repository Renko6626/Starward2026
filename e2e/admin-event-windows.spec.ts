import { test, expect } from "./fixtures";

test("活动窗口时间错误显示在结束时间字段旁", async ({ adminPage }) => {
  await adminPage.goto("/portal/admin/settings/windows");
  const card = adminPage.locator("section").filter({ has: adminPage.getByText("作品文件上传开放", { exact: true }) });
  await card.getByLabel("开始时间").fill("2026-11-13T10:00");
  await card.getByLabel("结束时间").fill("2026-11-13T09:00");
  await card.getByRole("button", { name: "保存窗口设置" }).click();

  const closesAt = card.getByLabel("结束时间");
  await expect(closesAt).toHaveAttribute("aria-invalid", "true");
  await expect(card.getByRole("alert")).toHaveText("结束时间必须晚于开始时间。");

  await closesAt.fill("2026-11-13T11:00");
  await expect(card.getByRole("alert")).toHaveCount(0);
  await card.getByRole("button", { name: "保存窗口设置" }).click();
  await expect(card.getByText("作品文件上传开放已更新。", { exact: true })).toBeVisible();
});
