import { test, expect, openPortal, rows, seed } from "./fixtures";

function waitForOverviewRefresh(page: Parameters<typeof openPortal>[0]) {
  return Promise.all(["dashboard", "application", "collaboration"].map((resource) =>
    page.waitForResponse((response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === `/api/portal/${resource}`,
    ),
  ));
}

test("审核通过作者可以保存并提交作品预告和审查说明", async ({ approvedPage }) => {
  await openPortal(approvedPage);

  const project = approvedPage.getByRole("region", { name: "作品资料" });
  await expect(project).toBeVisible();

  await project.getByLabel("作品标题").fill("E2E 作品预告");
  await project.getByLabel("作品简介").fill("用于验证作者作品资料提交流程。");
  await project.getByLabel("作品类型").selectOption("text");
  await project.getByLabel("作品形式").fill("短篇小说");
  const firstRefresh = waitForOverviewRefresh(approvedPage);
  await project.getByRole("button", { name: "保存作品预告", exact: true }).click();
  await expect(project.getByText("已保存作品预告。", { exact: true })).toBeVisible();
  await firstRefresh;

  await approvedPage.goto("/portal");
  await expect(approvedPage.getByRole("heading", { name: "作者档案" })).toBeVisible();
  const reloadedProject = approvedPage.getByRole("region", { name: "作品资料" });
  await expect(reloadedProject.getByLabel("作品标题")).toHaveValue("E2E 作品预告");
  await expect(reloadedProject.getByLabel("作品简介")).toHaveValue("用于验证作者作品资料提交流程。");
  await reloadedProject.getByRole("button", { name: "提交预告审核", exact: true }).click();
  await expect(reloadedProject.locator("#preview")).toContainText("已提交");

  const review = reloadedProject.locator("#review");
  await review.locator(":scope > summary").click();
  await review.getByLabel("内容概述").fill("作品围绕两位角色的观测记录展开。");
  await review.getByLabel("内容提醒").fill("无");
  await review.getByLabel("给主催的补充说明（选填）").fill("请按排期审核。");
  await review.getByRole("button", { name: "保存审查说明", exact: true }).click();
  await expect(reloadedProject.getByText("已保存审查说明。", { exact: true })).toBeVisible();
  await review.getByRole("button", { name: "提交说明审核", exact: true }).click();
  await expect(review).toContainText("已提交");

  const draft = (await rows("SELECT preview_title, preview_status, review_status, content_note, content_warnings FROM project_drafts WHERE id = 'draft_seed_active'"))[0];
  expect(draft.preview_title).toBe("E2E 作品预告");
  expect(draft.preview_status).toBe("submitted");
  expect(draft.review_status).toBe("submitted");
  expect(draft.content_note).toBe("作品围绕两位角色的观测记录展开。");
  expect(draft.content_warnings).toBe("无");
});

test("作品资料入口和兼容路由都能打开作者页对应区域", async ({ approvedPage }) => {
  await seed(`UPDATE schedule_segments SET status = 'open', current_participant_id = NULL WHERE id = 'seg_seed_102';
    UPDATE project_drafts SET segment_id = NULL WHERE id = 'draft_seed_active';`);

  await openPortal(approvedPage);
  await approvedPage.getByRole("link", { name: "填写作品资料", exact: true }).click();
  await expect(approvedPage).toHaveURL(/\/portal#project$/);
  await expect(approvedPage.getByRole("region", { name: "作品资料" })).toBeVisible();

  await approvedPage.goto("/portal/project");
  await expect(approvedPage).toHaveURL(/\/portal#project$/);
  await expect(approvedPage.getByRole("region", { name: "作品资料" })).toBeVisible();
});

test("待审核作者不能访问作品资料", async ({ pendingPage }) => {
  await openPortal(pendingPage);
  await expect(pendingPage.locator("#project")).toHaveCount(0);

  const response = await pendingPage.request.get("/api/portal/project");
  expect(response.status()).toBe(403);
});

test("提交窗口关闭时仍可保存但不能提交", async ({ approvedPage }) => {
  await seed(`UPDATE event_windows SET is_enabled = 0 WHERE key IN ('preview_submit_open', 'review_submit_open');`);
  await openPortal(approvedPage);

  const project = approvedPage.getByRole("region", { name: "作品资料" });
  await project.locator("#review > summary").click();
  await expect(project.getByRole("button", { name: "提交预告审核", exact: true })).toBeDisabled();
  await expect(project.getByRole("button", { name: "提交说明审核", exact: true })).toBeDisabled();
  await expect(project).toContainText("提交尚未开放");

  await project.getByLabel("作品标题").fill("窗口关闭时保存的预告");
  await project.getByRole("button", { name: "保存作品预告", exact: true }).click();
  await expect(project.getByText("已保存作品预告。", { exact: true })).toBeVisible();

  const draft = (await rows("SELECT preview_title, preview_status FROM project_drafts WHERE id = 'draft_seed_active'"))[0];
  expect(draft.preview_title).toBe("窗口关闭时保存的预告");
  expect(draft.preview_status).toBe("draft");
});

test("作者页显示主催反馈和作品资料审核状态", async ({ approvedPage }) => {
  await seed(`UPDATE project_drafts SET admin_feedback = '请补充作品的内容提醒。', preview_status = 'changes_requested' WHERE id = 'draft_seed_active';`);
  await openPortal(approvedPage);

  const project = approvedPage.getByRole("region", { name: "作品资料" });
  await expect(project.getByText("请补充作品的内容提醒。", { exact: true })).toBeVisible();
  await expect(project.locator("#preview")).toContainText("需修改");
});
