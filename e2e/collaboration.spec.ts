import { test, expect, openPortal, rows, approveSecondAuthor } from "./fixtures";
import { swapAuthors } from "./flows";

test("双作者换期后双方排期和作品关联同步，释放后可重新认领", async ({ approvedPage, pendingPage }) => {
  await approveSecondAuthor();
  await swapAuthors(approvedPage, pendingPage);
  await approvedPage.getByRole("button", { name: "确认释放当前发布时点" }).click();
  await expect.poll(() => rows("SELECT current_participant_id FROM schedule_segments WHERE id = 'seg_seed_101'"))
    .toEqual([{ current_participant_id: null }]);
  await approvedPage.goto("/works");
  await approvedPage.getByRole("button", { name: /00:00 UTC\+8.*待认领/ }).click();
  await approvedPage.getByRole("button", { name: "确认认领这个发布时点" }).click();
  await expect.poll(() => rows("SELECT current_participant_id FROM schedule_segments WHERE id = 'seg_seed_101'"))
    .toEqual([{ current_participant_id: "part_seed_active" }]);
  await openPortal(approvedPage);
  await expect(approvedPage.getByRole("region", { name: "报名进度" })).toContainText("00:00");
});
