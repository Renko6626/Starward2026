import { readFile } from "node:fs/promises";
import { test, expect, openPortal, rows } from "./fixtures";
import { registerAndApply } from "./flows";
import { WORK_FILE_PART_SIZE } from "../src/shared/work-files";

test("新作者注册报名，审核通过后上传、下载并删除作品文件", async ({ page, adminPage }) => {
  test.setTimeout(180_000);
  const opened = await adminPage.request.patch("/api/admin/event-windows/work_upload_open", {
    data: { isEnabled: true, opensAt: null, closesAt: null },
    headers: { origin: "http://127.0.0.1:21262" },
  });
  expect(opened.ok(), await opened.text()).toBe(true);
  await registerAndApply(page);
  await expect(page.getByLabel("选择作品文件", { exact: true })).toHaveCount(0);
  expect((await page.request.post("/api/portal/project/files", {
    data: { filename: "报名作品.txt", size: 12, contentType: "text/plain" },
  })).status()).toBe(403);

  await adminPage.goto("/portal/admin/participants?view=pending");
  await adminPage.getByRole("row").filter({ hasText: "E2E 新作者" }).getByRole("link", { name: "查看详情" }).click();
  await adminPage.getByRole("button", { name: "批准报名", exact: true }).click();
  await expect.poll(() => rows(`SELECT applications.status FROM applications
    JOIN "user" ON "user".id = applications.user_id WHERE "user".email = 'e2e-new@example.com'`))
    .toEqual([{ status: "approved" }]);
  expect(await rows(`SELECT participants.status FROM participants
    JOIN "user" ON "user".id = participants.user_id WHERE "user".email = 'e2e-new@example.com'`))
    .toEqual([{ status: "approved" }]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "作者档案" })).toBeVisible();
  await expect(page.getByRole("region", { name: "报名进度" })).toContainText("报名已通过");
  // Upload belongs to the approved registration even before a slot is assigned.
  const content = Buffer.from("从注册、报名到作品提交的本地验收。\n秘封旅行作品正文。");
  await page.getByLabel("选择作品文件", { exact: true }).setInputFiles({
    name: "报名作品.txt", mimeType: "text/plain", buffer: content,
  });
  await expect(page.getByText("作品文件已上传。", { exact: true })).toBeVisible();
  const files = await rows(`SELECT work_files.id, work_files.draft_id, work_files.filename,
    work_files.size, project_drafts.segment_id, "user".email
    FROM work_files JOIN project_drafts ON project_drafts.id = work_files.draft_id
    JOIN participants ON participants.id = project_drafts.participant_id
    JOIN "user" ON "user".id = participants.user_id WHERE work_files.completed_at IS NOT NULL`);
  expect(files).toEqual([{
    id: expect.any(String), draft_id: expect.any(String), filename: "报名作品.txt",
    size: content.length, segment_id: null, email: "e2e-new@example.com",
  }]);
  const file = files[0];
  await page.reload();
  const downloading = page.waitForEvent("download");
  await page.getByRole("link", { name: "报名作品.txt", exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("报名作品.txt");
  expect(await download.failure()).toBeNull();
  expect(await readFile((await download.path())!)).toEqual(content);

  await adminPage.goto(`/portal/admin/project-drafts/${file.draft_id}`);
  const adminDownloading = adminPage.waitForEvent("download");
  await adminPage.getByRole("region", { name: "作品文件" }).getByRole("link", { name: "报名作品.txt", exact: true }).click();
  const adminDownload = await adminDownloading;
  expect(await readFile((await adminDownload.path())!)).toEqual(content);

  await page.getByRole("button", { name: "删除 报名作品.txt", exact: true }).click();
  await expect(page.getByRole("link", { name: "报名作品.txt", exact: true })).toHaveCount(0);
  const afterDelete = await page.request.get("/api/portal/project/files");
  expect(afterDelete.ok()).toBe(true);
  expect((await afterDelete.json()).files).toEqual([]);
  expect(await rows("SELECT id FROM work_files")).toEqual([]);
  expect(await rows("SELECT file_id FROM work_file_parts")).toEqual([]);
  expect((await page.request.get(`/api/portal/project/files/${file.id}/download`)).status()).toBe(404);
  expect((await adminPage.request.get(`/api/admin/project-drafts/${file.draft_id}/files/${file.id}/download`)).status()).toBe(404);
});

test("作者上传多个作品文件，刷新后可下载，主催能读取文件，关闭入口后保留下载", async ({ approvedPage, pendingPage, adminPage, page }) => {
  const opened = await adminPage.request.patch("/api/admin/event-windows/work_upload_open", {
    data: { isEnabled: true, opensAt: null, closesAt: null },
    headers: { origin: "http://127.0.0.1:21262" },
  });
  expect(opened.ok(), await opened.text()).toBe(true);
  await openPortal(approvedPage);
  const bytes = Buffer.alloc(WORK_FILE_PART_SIZE + 17, 42);
  await approvedPage.getByLabel("选择作品文件", { exact: true }).setInputFiles([
    { name: "作品视频.mp4", mimeType: "video/mp4", buffer: bytes },
    { name: "小说.txt", mimeType: "text/plain", buffer: Buffer.from("一篇完整的小说。") },
  ]);
  await expect(approvedPage.getByText("作品文件已上传。", { exact: true })).toBeVisible();
  await approvedPage.reload();
  await expect(approvedPage.getByRole("link", { name: "作品视频.mp4", exact: true })).toBeVisible();
  const files = await rows("SELECT id, filename, size FROM work_files WHERE completed_at IS NOT NULL ORDER BY filename");
  expect(files).toHaveLength(2);
  const video = files.find(file => file.filename === "作品视频.mp4")!;
  const path = `/api/portal/project/files/${video.id}/download`;
  expect(await (await approvedPage.request.get(path)).body()).toEqual(bytes);
  expect((await page.request.get(path)).status()).toBe(401);
  expect((await pendingPage.request.get(path)).status()).toBe(403);
  await adminPage.goto("/portal/admin/project-drafts/draft_seed_active");
  await expect(adminPage.getByRole("region", { name: "作品文件" }).getByRole("link", { name: "作品视频.mp4" })).toBeVisible();
  expect(await (await adminPage.request.get(`/api/admin/project-drafts/draft_seed_active/files/${video.id}/download`)).body()).toEqual(bytes);
  await approvedPage.getByRole("button", { name: "删除 小说.txt", exact: true }).click();
  await expect(approvedPage.getByRole("link", { name: "小说.txt", exact: true })).toHaveCount(0);
  await adminPage.request.patch("/api/admin/event-windows/work_upload_open", { data: { isEnabled: false }, headers: { origin: "http://127.0.0.1:21262" } });
  await approvedPage.reload();
  await expect(approvedPage.getByLabel("选择作品文件", { exact: true })).toHaveCount(0);
  await expect(approvedPage.getByRole("link", { name: "作品视频.mp4", exact: true })).toBeVisible();
});

test("上传失败后清理未完成任务，可以重新选文件上传", async ({ approvedPage, adminPage }) => {
  await adminPage.request.patch("/api/admin/event-windows/work_upload_open", { data: { isEnabled: true }, headers: { origin: "http://127.0.0.1:21262" } });
  await openPortal(approvedPage);
  await approvedPage.route("**/api/portal/project/files/*/parts/*", route => route.fulfill({
    status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "测试上传中断" } }),
  }));
  const file = { name: "retry.txt", mimeType: "text/plain", buffer: Buffer.from("作品正文") };
  await approvedPage.getByLabel("选择作品文件", { exact: true }).setInputFiles(file);
  await expect(approvedPage.getByText("测试上传中断", { exact: true })).toBeVisible();
  await expect.poll(() => rows("SELECT id FROM work_files")).toEqual([]);
  await approvedPage.unroute("**/api/portal/project/files/*/parts/*");
  await approvedPage.getByLabel("选择作品文件", { exact: true }).setInputFiles(file);
  await expect(approvedPage.getByRole("link", { name: "retry.txt", exact: true })).toBeVisible();
});
