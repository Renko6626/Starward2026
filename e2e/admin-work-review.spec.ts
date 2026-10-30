import { test, expect, seed } from "./fixtures";

test("作品列表返回和刷新保留作品范围与搜索", async ({ adminPage }) => {
  await adminPage.goto("/portal/admin/project-drafts");
  await adminPage.getByLabel("作品范围").selectOption("all");
  await adminPage.getByRole("searchbox", { name: "搜索作品" }).fill("结界观测者");
  await adminPage.getByRole("row").filter({ hasText: "结界观测者" }).getByRole("button", { name: "查看作品" }).click();
  await adminPage.getByRole("link", { name: "返回作品列表" }).click();
  await expect(adminPage.getByLabel("作品范围")).toHaveValue("all");
  await expect(adminPage.getByRole("searchbox", { name: "搜索作品" })).toHaveValue("结界观测者");
  await adminPage.reload();
  await expect(adminPage.getByLabel("作品范围")).toHaveValue("all");
  await expect(adminPage.getByRole("searchbox", { name: "搜索作品" })).toHaveValue("结界观测者");
});

test("已发布作品保留意见功能，撤下后才能保存负面结论", async ({ adminPage }) => {
  await seed("UPDATE project_drafts SET preview_status = 'approved', review_status = 'approved', published_at = '2026-10-12T00:00:00.000Z' WHERE id = 'draft_seed_active'");
  await seed("INSERT INTO work_submissions (id,draft_id,version_number,title,work_type,summary,submitted_at) VALUES ('version_e2e','draft_seed_active',1,'作品','text','简介','2026-10-31')");
  await adminPage.goto("/portal/admin/project-drafts/draft_seed_active");
  await expect(adminPage.getByLabel("审核结论").locator('option[value="changes_requested"]')).toBeDisabled();
  await expect(adminPage.getByRole("button", { name: "保存审稿意见" })).toBeVisible();
  await adminPage.getByRole("button", { name: "撤下作品", exact: true }).click();
  await expect(adminPage.getByLabel("审核结论").locator('option[value="changes_requested"]')).toBeEnabled();
  await expect(adminPage.getByRole("button", { name: "保存审稿意见" })).toBeEnabled();
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
