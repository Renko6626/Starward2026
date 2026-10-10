import { optionalContactEmailSchema } from "./auth-identity";
import { z } from "zod";
import type { EventWindowSummary } from "./windows";
import type { ParticipantPortalStatus } from "./portal";

export const applicationInterestFormatValues = [
  "novel",
  "illustration",
  "comic",
  "music",
  "video",
  "cosplay",
  "other",
] as const;

export const applicationInterestFormatSchema = z.enum(
  applicationInterestFormatValues,
);

export const applicationStatusValues = [
  "pending",
  "approved",
  "rejected",
  "withdrawn",
] as const;

export const applicationStatusSchema = z.enum(applicationStatusValues);

const optionalShortTextSchema = z.string().trim().max(120).optional();
const optionalBodyTextSchema = z.string().trim().max(1600).optional();

const applicationInputSchema = z.object({
  contactEmail: optionalContactEmailSchema,
  contactHandle: optionalShortTextSchema,
  interestFormat: applicationInterestFormatSchema,
  introText: z.string().trim().min(1, "请简要描述准备创作什么。").max(1600),
  portfolioUrl: z.string().trim().url().max(500).optional(),
  messageToHosts: optionalBodyTextSchema,
});

export const createApplicationInputSchema = applicationInputSchema.extend({
  turnstileToken: z.string().trim().min(1).optional(),
});

export const upsertPortalApplicationInputSchema = applicationInputSchema;
export const updateApplicationIntentInputSchema = applicationInputSchema
  .pick({ interestFormat: true, introText: true }).strict();
export type UpdateApplicationIntentInput = z.infer<typeof updateApplicationIntentInputSchema>;

export const updateApplicationReviewInputSchema = z.object({
  status: applicationStatusSchema,
  adminNote: z.string().trim().max(2000).optional(),
});

export type CreateApplicationInput = z.infer<
  typeof createApplicationInputSchema
>;
export type UpsertPortalApplicationInput = z.infer<
  typeof upsertPortalApplicationInputSchema
>;
export type UpdateApplicationReviewInput = z.infer<
  typeof updateApplicationReviewInputSchema
>;

export type ApplicationListItem = {
  id: string;
  displayName: string;
  contactEmail: string | null;
  contactHandle: string | null;
  interestFormat: ApplicationInterestFormat;
  status: ApplicationStatus;
  createdAt: string;
  reviewedAt: string | null;
  authUserEmail: string | null;
  hasPortalProfile: boolean;
  participantId: string | null;
  participantStatus: ParticipantPortalStatus | null;
};

export type ApplicationDetail = ApplicationListItem & {
  introText: string | null;
  portfolioUrl: string | null;
  messageToHosts: string | null;
  adminNote: string | null;
  reviewedBy: string | null;
  updatedAt: string;
  authUser: {
    id: string;
    email: string | null;
  } | null;
  portalProfile: {
    creditName: string;
    contactEmail: string | null;
    primaryContactChannel: string;
    primaryContactHandle: string;
    backupContact: string | null;
    isAnonymous: boolean;
  } | null;
  participant: {
    id: string;
    inviteEmail: string | null;
    status: ParticipantPortalStatus;
    activatedAt: string | null;
  } | null;
};

export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;
export type ApplicationInterestFormat = z.infer<
  typeof applicationInterestFormatSchema
>;

export type ParticipationStatistics = {
  registeredCreators: number;
  schedule: { occupied: number; total: number } | null;
};

export type ApplicationIntakeResponse = {
  isOpen: boolean;
  turnstileEnabled: boolean;
  window: EventWindowSummary | null;
  statistics: ParticipationStatistics | null;
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

export type AdminApplicationReviewNotification = {
  status: "sent" | "failed";
  message: string;
};

export type AdminApplicationDetailResponse = {
  application: ApplicationDetail;
  notification?: AdminApplicationReviewNotification | null;
};

export const applicationInterestFormatLabels: Record<
  ApplicationInterestFormat,
  string
> = {
  novel: "小说 / 文本",
  illustration: "插画",
  comic: "漫画",
  music: "音乐",
  video: "视频",
  cosplay: "Cosplay",
  other: "其他",
};

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  pending: "报名审核中",
  approved: "审核已通过",
  rejected: "已拒绝",
  withdrawn: "已撤回",
};
