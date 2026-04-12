import { z } from "zod";
import type { EventWindowSummary } from "./windows";
import type { ParticipantPortalStatus } from "./portal";

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
const optionalDisplayNameSchema = z.string().trim().max(80).optional();

const applicationInputSchema = z.object({
  displayName: optionalDisplayNameSchema,
  contactEmail: z.string().trim().email().max(320),
  contactHandle: optionalShortTextSchema,
  interestFormat: applicationInterestFormatSchema,
  introText: optionalBodyTextSchema,
  portfolioUrl: z.string().trim().url().max(500).optional(),
  messageToHosts: optionalBodyTextSchema,
});

export const createApplicationInputSchema = applicationInputSchema.extend({
  turnstileToken: z.string().trim().min(1).optional(),
});

export const upsertPortalApplicationInputSchema = applicationInputSchema;

export const updateApplicationReviewInputSchema = z.object({
  status: applicationStatusSchema,
  adminNote: z.string().trim().max(2000).optional(),
});

export type CreateApplicationInput = z.infer<typeof createApplicationInputSchema>;
export type UpsertPortalApplicationInput = z.infer<typeof upsertPortalApplicationInputSchema>;
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
  authUser:
    | {
        id: string;
        email: string;
      }
    | null;
  portalProfile:
    | {
        penName: string | null;
        contactEmail: string;
        primaryContactChannel: string;
        primaryContactHandle: string;
        backupContact: string | null;
        publicCreditMode: "named" | "pseudonymous" | "anonymous";
        publicCreditName: string | null;
      }
    | null;
  participant:
    | {
        id: string;
        inviteEmail: string;
        status: ParticipantPortalStatus;
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

export type AdminApplicationReviewNotification = {
  status: "sent" | "failed";
  message: string;
};

export type AdminApplicationDetailResponse = {
  application: ApplicationDetail;
  notification?: AdminApplicationReviewNotification | null;
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
