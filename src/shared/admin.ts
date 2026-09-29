import { z } from "zod";
import {
  portalSegmentStatusSchema,
  projectDraftStatusSchema,
  type ParticipantPortalStatus,
  type ProjectDraftStatus,
  type PortalSegmentStatus,
} from "./portal";
import type { EventWindowSummary } from "./windows";

export const adminParticipantStatusValues = [
  "pending",
  "approved",
  "withdrawn",
  "completed",
] as const;

export const adminParticipantStatusSchema = z.enum(
  adminParticipantStatusValues,
);

export type AdminParticipantStatus = z.infer<
  typeof adminParticipantStatusSchema
>;

export const adminParticipantStatusLabels: Record<
  AdminParticipantStatus,
  string
> = {
  pending: "待审核",
  approved: "已批准",
  withdrawn: "已撤回",
  completed: "已完成",
};

export type AdminParticipantItem = {
  isAnonymous: boolean;
  id: string;
  displayName: string;
  inviteEmail: string;
  contactHandle: string | null;
  status: ParticipantPortalStatus;
  applicationId: string | null;
  currentSegmentCode: string | null;
  updatedAt: string;
};

export type AdminParticipantListResponse = {
  items: AdminParticipantItem[];
};

export type AdminParticipantDetail = AdminParticipantItem & {
  userId: string | null;
  currentSegmentName: string | null;
  invitedAt: string | null;
  activatedAt: string | null;
};

export type AdminParticipantDetailResponse = {
  participant: AdminParticipantDetail;
};

export const updateParticipantInputSchema = z.object({
  contactHandle: z.string().trim().max(120).optional(),
  status: adminParticipantStatusSchema,
});

export type UpdateParticipantInput = z.infer<
  typeof updateParticipantInputSchema
>;

export type AdminParticipantInviteResponse = {
  ok: true;
  message: string;
  participant: AdminParticipantDetail;
};

export const adminSegmentStatusLabels: Record<PortalSegmentStatus, string> = {
  open: "可认领",
  held: "已认领",
  locked: "锁定",
  released: "已释放",
  completed: "已完成",
};

export type AdminSegmentItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: PortalSegmentStatus;
  currentParticipantId: string | null;
  currentParticipantName: string | null;
  claimedAt: string | null;
  releasedAt: string | null;
  sortOrder: number;
  updatedAt: string;
};

export type AdminSegmentListResponse = {
  items: AdminSegmentItem[];
};

export const updateSegmentInputSchema = z.object({
  description: z.string().trim().max(240).nullable().optional(),
  status: portalSegmentStatusSchema,
  currentParticipantId: z.string().trim().min(1).max(64).nullable().optional(),
});

export type UpdateSegmentInput = z.infer<typeof updateSegmentInputSchema>;

export const bootstrapSegmentsInputSchema = z.object({
  count: z.number().int().min(1).max(120),
});

export type BootstrapSegmentsInput = z.infer<
  typeof bootstrapSegmentsInputSchema
>;

export type AdminSegmentBootstrapResponse = {
  ok: true;
  message: string;
  items: AdminSegmentItem[];
};

export type AdminSegmentMutationResponse = {
  ok: true;
  message: string;
  item: AdminSegmentItem;
};

export const adminProjectDraftStatusLabels: Record<ProjectDraftStatus, string> =
  {
    not_started: "未开始",
    draft: "草稿",
    submitted: "已提交",
    changes_requested: "需修改",
    approved: "已通过",
  };

export type AdminProjectDraftItem = {
  id: string;
  participantId: string;
  participantName: string;
  segmentCode: string | null;
  previewStatus: ProjectDraftStatus;
  reviewStatus: ProjectDraftStatus;
  previewTitle: string | null;
  publicAuthorName: string | null;
  updatedAt: string;
};

export type AdminProjectDraftListResponse = {
  items: AdminProjectDraftItem[];
};

export type AdminProjectDraftDetail = AdminProjectDraftItem & {
  participantInviteEmail: string;
  participantContactHandle: string | null;
  participantStatus: ParticipantPortalStatus;
  segmentName: string | null;
  previewSummary: string | null;
  formatLabel: string | null;
  publicTags: string[];
  contentNote: string | null;
  contentWarnings: string | null;
  reviewNote: string | null;
  adminFeedback: string | null;
  previewSubmittedAt: string | null;
  reviewSubmittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

export type AdminProjectDraftDetailResponse = {
  draft: AdminProjectDraftDetail;
};

export const updateProjectDraftInputSchema = z.object({
  previewStatus: projectDraftStatusSchema,
  reviewStatus: projectDraftStatusSchema,
  adminFeedback: z.string().trim().max(2000).nullable().optional(),
});

export type UpdateProjectDraftInput = z.infer<
  typeof updateProjectDraftInputSchema
>;

export type AdminProjectDraftMutationResponse = {
  ok: true;
  message: string;
  draft: AdminProjectDraftDetail;
};

export type AdminEventWindowListResponse = {
  items: EventWindowSummary[];
};

export type AdminEventWindowMutationResponse = {
  ok: true;
  message: string;
  item: EventWindowSummary;
};
