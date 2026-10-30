import { test, expect, openPortal } from "./fixtures";

// Formal submission and version review are covered by the Worker route tests.
test("已通过作者在工作台看到作品主面板，旧入口返回工作台", async ({ approvedPage }) => {
  await openPortal(approvedPage);
  await expect(approvedPage.getByRole("region", { name: "作品提交与审核" })).toBeVisible();
  await expect(approvedPage.getByRole("link", { name: "填写作品资料", exact: true })).toHaveCount(0);
  await expect(approvedPage.getByRole("navigation", { name: "档案目录" })).toContainText("基本信息");
  await expect(approvedPage.getByRole("navigation", { name: "档案目录" })).toContainText("创作意向");

  await approvedPage.goto("/portal/project");
  await expect(approvedPage).toHaveURL(/\/portal\/?$/);
  await expect(approvedPage.getByRole("heading", { name: "作者档案" })).toBeVisible();
  await expect(approvedPage.locator("#project")).toHaveCount(0);
});

test("待审核作者不能访问作品资料", async ({ pendingPage }) => {
  await openPortal(pendingPage);
  await expect(pendingPage.locator("#project")).toHaveCount(0);

  const response = await pendingPage.request.get("/api/portal/project");
  expect(response.status()).toBe(403);
});
