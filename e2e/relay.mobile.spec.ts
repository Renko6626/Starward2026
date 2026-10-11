import { test, expect, approveSecondAuthor } from "./fixtures";
import { registerAndApply, swapAuthors } from "./flows";

test("手机完成注册报名及再次登录", async ({ page }) => {
  await registerAndApply(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("手机双作者换期并确认结果", async ({ approvedPage, pendingPage }) => {
  await approveSecondAuthor();
  await swapAuthors(approvedPage, pendingPage);
  expect(await approvedPage.evaluate(() => innerWidth)).toBe(390);
});
