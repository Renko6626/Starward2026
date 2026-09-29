export type ReviewNoteTemplate = {
  id: "approved" | "awaiting-profile" | "rejected-info" | "withdrawn";
  label: string;
  body: string;
};

const reviewNoteTemplates: ReviewNoteTemplate[] = [
  {
    id: "approved",
    label: "批准模板",
    body: "已核对报名内容与现有联系方式，准许开放本期参与资格。后续请继续使用同一邮箱进入创作者工作台，处理时间段与作品提交流程。",
  },
  {
    id: "awaiting-profile",
    label: "待补资料模板",
    body: "已收到报名，但当前联系资料仍不足以完成确认。请先通过参与者入口补充署名与主联系渠道，随后再继续审核。",
  },
  {
    id: "rejected-info",
    label: "资料不足模板",
    body: "当前提交信息不足以支撑本期安排，暂不予通过。如需后续重新申请，请补充代表作链接、创作说明与稳定联系方式。",
  },
  {
    id: "withdrawn",
    label: "撤回模板",
    body: "根据申请者意愿或后续沟通结果，当前报名已撤回，不继续开放本期参与资格。",
  },
];

export function getReviewNoteTemplates() {
  return reviewNoteTemplates;
}
