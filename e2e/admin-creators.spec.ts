import { test, expect, rows } from "./fixtures";

test("参与者列表返回、后退和刷新保留筛选与搜索", async ({ adminPage }) => {
  await adminPage.goto("/portal/admin/participants?view=all");
  await adminPage.getByRole("searchbox", { name: "搜索参与者" }).fill("结界观测者");
  const detailLink = adminPage.getByRole("row").filter({ hasText: "结界观测者" }).getByRole("link", { name: "查看详情" });
  await detailLink.click();
  await adminPage.getByRole("link", { name: "返回参与者管理" }).click();
  await expect(adminPage.getByRole("link", { name: /全部创作者 \(/ })).toHaveAttribute("aria-current", "page");
  await expect(adminPage.getByRole("searchbox", { name: "搜索参与者" })).toHaveValue("结界观测者");
  await detailLink.click();
  await adminPage.goBack();
  await adminPage.reload();
  await expect(adminPage.getByRole("searchbox", { name: "搜索参与者" })).toHaveValue("结界观测者");
  await expect(detailLink).toBeVisible();

  await adminPage.getByRole("searchbox", { name: "搜索参与者" }).fill("");
  await adminPage.getByRole("link", { name: "已通过待安排", exact: true }).click();
  await expect(adminPage.getByText("当前没有已通过且待安排的创作者。", { exact: true })).toBeVisible();
});

test("参与者详情的审核和席位操作保留另一编辑区的草稿", async ({ adminPage }) => {
  await adminPage.goto("/portal/admin/participants/part_seed_pending");
  const reviewNote = adminPage.getByLabel("审核意见（创作者可见）");
  await reviewNote.fill("报名审核意见草稿");

  const participantEditor = adminPage.locator("details.admin-disclosure").filter({ hasText: "修改资格与联系备注" });
  await participantEditor.locator("summary").click();
  const contactHandle = participantEditor.getByLabel("联系方式备注");
  await contactHandle.fill("已保存的联系备注");
  await participantEditor.getByRole("button", { name: "保存参与者设置" }).click();
  await expect(contactHandle).toHaveValue("已保存的联系备注");
  await expect(reviewNote).toHaveValue("报名审核意见草稿");

  await contactHandle.fill("尚未保存的联系备注");
  await adminPage.getByRole("button", { name: "批准报名", exact: true }).click();
  await expect.poll(() => rows("SELECT status FROM applications WHERE id = 'app_seed_portal_pending'"))
    .toEqual([{ status: "approved" }]);
  await expect(reviewNote).toHaveValue("报名审核意见草稿");
  await expect(contactHandle).toHaveValue("尚未保存的联系备注");
  await expect(participantEditor.getByLabel("参与资格")).toHaveValue("approved");

  await adminPage.getByLabel("分配席位").selectOption("seg_seed_101");
  await adminPage.getByRole("button", { name: "分配发布时间", exact: true }).click();
  await expect(contactHandle).toHaveValue("尚未保存的联系备注");
  await expect(reviewNote).toHaveValue("报名审核意见草稿");
});
