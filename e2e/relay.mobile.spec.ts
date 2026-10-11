import { test, expect, approveSecondAuthor } from "./fixtures";
import { registerAndApply, swapAuthors, verifyScheduleIntent } from "./flows";

test("手机浏览和选时报名保持明确意向", async ({ pendingPage }) => {
  await verifyScheduleIntent(pendingPage);
});

test("手机完成注册报名及再次登录", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await registerAndApply(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("手机双作者换期并确认结果", async ({ approvedPage, pendingPage }) => {
  await approveSecondAuthor();
  await swapAuthors(approvedPage, pendingPage);
  expect(await approvedPage.evaluate(() => innerWidth)).toBe(390);
});
