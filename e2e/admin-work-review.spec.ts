import { test, expect, seed } from "./fixtures";

test("作品列表返回和刷新保留作品范围与搜索", async ({ adminPage }) => {
  await adminPage.goto("/portal/admin/project-drafts");
  await adminPage.getByLabel("作品范围").selectOption("all");
  await adminPage.getByRole("searchbox", { name: "搜索作品" }).fill("结界观测者");
  await adminPage.getByRole("row").filter({ hasText: "结界观测者" }).getByRole("link", { name: "查看详情" }).click();
  await adminPage.getByRole("link", { name: "返回草案库" }).click();
  await expect(adminPage.getByLabel("作品范围")).toHaveValue("all");
  await expect(adminPage.getByRole("searchbox", { name: "搜索作品" })).toHaveValue("结界观测者");
  await adminPage.reload();
  await expect(adminPage.getByLabel("作品范围")).toHaveValue("all");
  await expect(adminPage.getByRole("searchbox", { name: "搜索作品" })).toHaveValue("结界观测者");
});

test("已发布作品隐藏审核保存按钮，撤下后恢复编辑", async ({ adminPage }) => {
  await seed("UPDATE project_drafts SET preview_status = 'approved', review_status = 'approved', published_at = '2026-10-12T00:00:00.000Z' WHERE id = 'draft_seed_active'");
  await adminPage.goto("/portal/admin/project-drafts/draft_seed_active");
  await expect(adminPage.getByLabel("预告审核状态")).toBeDisabled();
  await expect(adminPage.getByRole("button", { name: "保存审核结果" })).toHaveCount(0);
  await adminPage.getByRole("button", { name: "撤下作品", exact: true }).click();
  await expect(adminPage.getByLabel("预告审核状态")).toBeEnabled();
  await expect(adminPage.getByRole("button", { name: "保存审核结果" })).toBeEnabled();
});

test("公开预览展开后进入视口并正确恢复焦点", async ({ adminPage }) => {
  await adminPage.setViewportSize({ width: 390, height: 844 });
  await adminPage.emulateMedia({ reducedMotion: "reduce" });
  await adminPage.goto("/portal/admin/project-drafts/draft_seed_active");
  const trigger = adminPage.locator('button[aria-controls="public-work-preview"]');
  await trigger.click();

  const preview = adminPage.locator("#public-work-preview");
  await expect(preview).toBeInViewport({ ratio: 0.1 });
  await expect(preview).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  await adminPage.getByRole("button", { name: "收起公开预览" }).click();
  await expect(adminPage.locator("#public-work-preview")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
