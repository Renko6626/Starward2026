import type { ZodIssue } from "zod";

const fields: Record<string, { label: string; message: string }> = {
  "profile.creditName": { label: "署名", message: "请填写署名。" },
  "profile.bilibiliUid": { label: "B站主页链接或 UID", message: "请填写 B站主页链接或数字 UID，不能填写昵称。" },
  "profile.contactEmail": { label: "注册邮箱", message: "请检查注册邮箱格式。" },
  "profile.primaryContactChannel": { label: "联系方式类型", message: "请选择联系方式。" },
  "profile.primaryContactHandle": { label: "联系账号", message: "请填写联系账号。" },
  "profile.backupContact": { label: "备用联系方式", message: "请检查备用联系方式。" },
  "application.interestFormat": { label: "参加形式", message: "请选择参加形式。" },
  "application.introText": { label: "创作简介", message: "请检查创作简介。" },
  "application.portfolioUrl": { label: "作品或主页链接", message: "请填写完整链接，例如 https://example.com/works。" },
  "application.messageToHosts": { label: "给主催的话", message: "请检查给主催的话。" },
  segmentId: { label: "发布时间", message: "请选择一个可用的发布时间。" },
};

export function getRegistrationFieldErrors(issues: readonly ZodIssue[], prefix?: "profile") {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const path = [...(prefix ? [prefix] : []), ...issue.path].join(".");
    const key = path === "application.contactHandle" ? "profile.primaryContactHandle"
      : path === "application.contactEmail" ? "profile.contactEmail" : path;
    const field = fields[key];
    if (!field || errors[key]) continue;
    errors[key] = path === "application.contactHandle" && issue.code === "too_big"
      ? `联系账号连同联系方式类型最多填写 ${issue.maximum} 个字符。`
      : issue.code === "too_big" ? `${field.label}最多填写 ${issue.maximum} 个字符。`
      : field.message;
  }
  return errors;
}
