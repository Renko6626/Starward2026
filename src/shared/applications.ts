import { z } from "zod";
import type { EventWindowSummary } from "./windows";

export const applicationInterestFormatValues = [
  "novel",
  "illustration",
  "comic",
  "music",
  "video",
  "mixed",
  "other",
] as const;

export const applicationInterestFormatSchema = z.enum(applicationInterestFormatValues);

export const applicationStatusValues = ["pending", "approved", "rejected", "withdrawn"] as const;

export const applicationStatusSchema = z.enum(applicationStatusValues);

const optionalShortTextSchema = z.string().trim().max(120).optional();
const optionalBodyTextSchema = z.string().trim().max(1600).optional();

export const createApplicationInputSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  contactEmail: z.string().trim().email().max(320),
  contactHandle: optionalShortTextSchema,
  interestFormat: applicationInterestFormatSchema,
  introText: optionalBodyTextSchema,
  portfolioUrl: z.string().trim().url().max(500).optional(),
  messageToHosts: optionalBodyTextSchema,
  turnstileToken: z.string().trim().min(1).optional(),
});

export const updateApplicationReviewInputSchema = z.object({
  status: applicationStatusSchema,
  adminNote: z.string().trim().max(2000).optional(),
});

export type CreateApplicationInput = z.infer<typeof createApplicationInputSchema>;
export type UpdateApplicationReviewInput = z.infer<typeof updateApplicationReviewInputSchema>;

export type ApplicationListItem = {
  id: string;
  displayName: string;
  contactEmail: string;
  contactHandle: string | null;
  interestFormat: ApplicationInterestFormat;
  status: ApplicationStatus;
  createdAt: string;
  reviewedAt: string | null;
  participantId: string | null;
};

export type ApplicationDetail = ApplicationListItem & {
  introText: string | null;
  portfolioUrl: string | null;
  messageToHosts: string | null;
  adminNote: string | null;
  reviewedBy: string | null;
  updatedAt: string;
  participant:
    | {
        id: string;
        inviteEmail: string;
        status: "invited" | "active" | "withdrawn" | "completed";
        activatedAt: string | null;
      }
    | null;
};

export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;
export type ApplicationInterestFormat = z.infer<typeof applicationInterestFormatSchema>;

export type ApplicationIntakeResponse = {
  isOpen: boolean;
  turnstileEnabled: boolean;
  window: EventWindowSummary | null;
  interestFormats: Array<{
    value: ApplicationInterestFormat;
    label: string;
  }>;
};

export type CreateApplicationResponse = {
  ok: true;
  applicationId: string;
};

export type AdminApplicationListResponse = {
  items: ApplicationListItem[];
};

export type AdminApplicationDetailResponse = {
  application: ApplicationDetail;
};

export const applicationInterestFormatLabels: Record<ApplicationInterestFormat, string> = {
  novel: "小说 / 文本",
  illustration: "插画",
  comic: "漫画",
  music: "音乐",
  video: "视频",
  mixed: "混合形式",
  other: "其他",
};

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已拒绝",
  withdrawn: "已撤回",
};
