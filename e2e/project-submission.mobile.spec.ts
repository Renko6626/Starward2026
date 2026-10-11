import { test, expect, openPortal } from "./fixtures";

test("移动端作品资料区域可操作且页面不横向溢出", async ({ approvedPage }) => {
  await openPortal(approvedPage);

  const project = approvedPage.getByRole("region", { name: "作品资料" });
  await expect(project).toBeVisible();
  await project.getByLabel("作品标题").fill("移动端 E2E 预告");
  await expect(project.getByLabel("作品标题")).toHaveValue("移动端 E2E 预告");

  const fitsViewport = await approvedPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  expect(fitsViewport).toBe(true);
});
