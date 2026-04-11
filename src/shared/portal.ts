import { z } from "zod";
import type { EventWindowSummary } from "./windows";

export type ParticipantPortalStatus = "invited" | "active" | "withdrawn" | "completed";

export const projectDraftStatusValues = [
  "not_started",
  "draft",
  "submitted",
  "changes_requested",
  "approved",
] as const;

export const projectDraftStatusSchema = z.enum(projectDraftStatusValues);

export type ProjectDraftStatus = z.infer<typeof projectDraftStatusSchema>;

export const projectDraftStatusLabels: Record<ProjectDraftStatus, string> = {
  not_started: "未开始",
  draft: "草稿",
  submitted: "已提交",
  changes_requested: "需修改",
  approved: "已通过",
};

export type PortalAuthUserSummary = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

export type PortalParticipantSummary = {
  id: string;
  displayName: string;
  inviteEmail: string;
  contactHandle: string | null;
  status: ParticipantPortalStatus;
  activatedAt: string | null;
  currentSegmentCode: string | null;
  currentSegmentName: string | null;
  updatedAt: string;
};

export const portalSegmentStatusSchema = z.enum(["open", "held", "locked", "released", "completed"]);

export type PortalSegmentStatus = z.infer<typeof portalSegmentStatusSchema>;

export type PortalSegmentSummary = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: PortalSegmentStatus;
  claimedAt: string | null;
  releasedAt: string | null;
  sortOrder: number;
};

export type PortalProjectDraftSummary = {
  id: string;
  previewStatus: ProjectDraftStatus;
  reviewStatus: ProjectDraftStatus;
  previewTitle: string | null;
  publicAuthorName: string | null;
  updatedAt: string;
};

export type PortalProjectDraftDetail = PortalProjectDraftSummary & {
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
};

export type PortalEventItem = {
  id: string;
  eventType: string;
  actorType: "participant" | "admin" | "system";
  actorLabel: string;
  label: string;
  createdAt: string;
};

export type PortalMeResponse = {
  user: PortalAuthUserSummary;
  participant: PortalParticipantSummary;
};

export type PortalDashboardResponse = PortalMeResponse & {
  currentSegment: PortalSegmentSummary | null;
  projectDraft: PortalProjectDraftSummary | null;
  windows: EventWindowSummary[];
  recentEvents: PortalEventItem[];
};

export type PortalSegmentActionState = {
  canClaim: boolean;
  canChange: boolean;
  canRelease: boolean;
  claimHint: string;
  changeHint: string;
  releaseHint: string;
};

export type PortalCurrentSegmentResponse = PortalMeResponse & {
  currentSegment: PortalSegmentSummary | null;
  actions: PortalSegmentActionState;
  windows: EventWindowSummary[];
};

export type PortalProjectResponse = PortalMeResponse & {
  draft: PortalProjectDraftDetail;
  windows: EventWindowSummary[];
};

export type PortalHistoryResponse = PortalMeResponse & {
  items: PortalEventItem[];
};

export type PortalAvailableSegmentSummary = PortalSegmentSummary & {
  isAvailable: boolean;
};

export type PortalAvailableSegmentListResponse = {
  items: PortalAvailableSegmentSummary[];
};

export const segmentMutationInputSchema = z.object({
  segmentId: z.string().trim().min(1).max(64),
});

export type SegmentMutationInput = z.infer<typeof segmentMutationInputSchema>;

export type PortalSegmentMutationResponse = {
  ok: true;
  message: string;
  segment: PortalSegmentSummary | null;
};

export const updatePortalProjectPreviewInputSchema = z.object({
  previewTitle: z.string().trim().max(120).optional(),
  previewSummary: z.string().trim().max(1600).optional(),
  publicAuthorName: z.string().trim().max(80).optional(),
  formatLabel: z.string().trim().max(80).optional(),
  publicTags: z.array(z.string().trim().min(1).max(32)).max(12).optional(),
});

export type UpdatePortalProjectPreviewInput = z.infer<typeof updatePortalProjectPreviewInputSchema>;

export const updatePortalProjectReviewInputSchema = z.object({
  contentNote: z.string().trim().max(2000).optional(),
  contentWarnings: z.string().trim().max(800).optional(),
  reviewNote: z.string().trim().max(2000).optional(),
});

export type UpdatePortalProjectReviewInput = z.infer<typeof updatePortalProjectReviewInputSchema>;

export type PortalProjectMutationResponse = {
  ok: true;
  message: string;
  draft: PortalProjectDraftDetail;
};
