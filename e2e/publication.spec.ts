import { test, expect, openPortal, seed, rows } from "./fixtures";

// The author publication component currently has no route consumer. Exercise
// its existing Worker contract, then verify the real public browser experience.
test("作者确认发布后公开作品可访问，修改链接保留首次确认时间", async ({ approvedPage, page }) => {
  await seed(`UPDATE schedule_segments SET scheduled_at = '${new Date().toISOString()}' WHERE id = 'seg_seed_102';
    UPDATE project_drafts SET preview_status = 'approved', review_status = 'approved', work_type = 'text' WHERE id = 'draft_seed_active';`);
  await openPortal(approvedPage);
  const before = await page.request.get("/api/works/draft_seed_active");
  expect(before.status()).toBe(404);
  const release = await approvedPage.request.post("/api/portal/project/release", { data: { workUrl: "https://example.com/e2e-work" } });
  expect(release.ok(), await release.text()).toBe(true);
  const original = (await rows("SELECT release_confirmed_at FROM project_drafts WHERE id = 'draft_seed_active'"))[0].release_confirmed_at;
  expect(original).toBeTruthy();
  await page.goto("/works/draft_seed_active");
  await expect(page.getByRole("heading", { name: "结界观测预告", exact: true })).toBeVisible();
  await expect(page.locator('a[href="https://example.com/e2e-work"]')).toBeVisible();
  const edit = await approvedPage.request.post("/api/portal/project/release", { data: { workUrl: "https://example.com/e2e-corrected" } });
  expect(edit.ok(), await edit.text()).toBe(true);
  await page.reload();
  await expect(page.locator('a[href="https://example.com/e2e-corrected"]')).toBeVisible();
  expect((await rows("SELECT release_confirmed_at FROM project_drafts WHERE id = 'draft_seed_active'"))[0].release_confirmed_at).toBe(original);
});
