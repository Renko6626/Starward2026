import { z } from "zod";
import type { ApplicationInterestFormat } from "./applications";

export const workTypeSchema = z.enum(["text", "illustration", "comic", "music", "video", "cosplay", "other"]);
export type WorkType = z.infer<typeof workTypeSchema>;
export const workTypeLabels: Record<WorkType, string> = {
  text: "文字", illustration: "插画", comic: "漫画", music: "音乐", video: "视频", cosplay: "Cosplay", other: "其他",
};

export const publicHttpsUrlSchema = z.string().trim().max(2048).url("请填写完整的网址。").refine(
  (value) => {
    try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }
    catch { return false; }
  },
  "请使用不含账号密码的 HTTPS 公开地址。",
);
export const workPublicationFieldsSchema = z.object({
  workType: workTypeSchema.nullable().optional(),
  coverUrl: z.union([publicHttpsUrlSchema, z.literal("")]).optional(),
  coverAlt: z.string().trim().max(240).optional(),
  workUrl: z.union([publicHttpsUrlSchema, z.literal("")]).optional(),
});

export type WorkPublicationFields = {
  workType: WorkType | null;
  coverUrl: string | null;
  coverAlt: string | null;
  workUrl: string | null;
  publishedAt: string | null;
};

export type WorkPresentation = WorkPublicationFields & {
  previewTitle: string | null;
  previewSummary: string | null;
  publicAuthorName: string | null;
  formatLabel: string | null;
  publicTags: string[];
};
export type PublicWork = WorkPresentation & {
  id: string;
  observationNumber: number;
  segmentCode: string | null;
  segmentName: string | null;
};
export type ScheduleSegmentKind = 'standard' | 'extra' | 'special';
export type PublicScheduleEntry = {
  kind: ScheduleSegmentKind;
  id: string;
  code: string;
  name: string;
  scheduledAt: string | null;
  status: "available" | "reserved" | "confirmed" | "unavailable";
  publicAuthorName: string | null;
  interestFormat: ApplicationInterestFormat | null;
  introText: string | null;
  preview: Pick<WorkPresentation, "previewTitle" | "previewSummary" | "workType" | "coverUrl" | "coverAlt"> | null;
  workId: string | null;
};
export type PublicWorksResponse = { items: PublicWork[]; schedule: PublicScheduleEntry[] };
export type PublicWorkDetailResponse = {
  work: PublicWork;
  previous: PublicWork | null;
  next: PublicWork | null;
};

export function getWorkPublicationIssues(work: WorkPresentation & { previewStatus: string; reviewStatus: string }) {
  const issues: string[] = [];
  if (work.previewStatus !== "approved" || work.reviewStatus !== "approved") issues.push("预告与审查均需通过审核");
  if (!work.previewTitle?.trim()) issues.push("填写作品标题");
  if (!work.previewSummary?.trim()) issues.push("填写作品简介");
  if (!work.publicAuthorName?.trim()) issues.push("完善个人档案署名");
  if (!work.workType) issues.push("选择作品类型");
  if (!work.workUrl || !publicHttpsUrlSchema.safeParse(work.workUrl).success) issues.push("填写正式作品的 HTTPS 链接");
  if (work.coverUrl && !publicHttpsUrlSchema.safeParse(work.coverUrl).success) issues.push("填写封面的 HTTPS 地址");
  return issues;
}
