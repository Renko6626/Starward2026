import { describe, expect, it } from "vitest";

describe("getReviewNoteTemplates", () => {
  it("returns formal reusable note templates for common admin outcomes", async () => {
    const { getReviewNoteTemplates } = await import("./review-note");

    expect(getReviewNoteTemplates()).toEqual([
      {
        id: "approved",
        label: "批准模板",
        body: "已核对报名内容与现有联系方式，准许转入参与者流程。后续请继续使用同一邮箱进入参与者入口。",
      },
      {
        id: "awaiting-profile",
        label: "待补资料模板",
        body: "已收到报名，但当前联系资料仍不足以完成确认。请先通过参与者入口补充笔名、主联系渠道与公开署名设置，随后再继续审核。",
      },
      {
        id: "rejected-info",
        label: "资料不足模板",
        body: "当前提交信息不足以支撑本期安排，暂不予通过。如需后续重新申请，请补充代表作链接、创作说明与稳定联系方式。",
      },
      {
        id: "withdrawn",
        label: "撤回模板",
        body: "根据申请者意愿或后续沟通结果，当前报名已撤回，不继续进入本期参与者流程。",
      },
    ]);
  });
});
