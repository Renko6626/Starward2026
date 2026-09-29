import { z } from "zod";
import type {
  ApplicationInterestFormat,
  ApplicationStatus,
} from "./applications";
import type { EventWindowSummary } from "./windows";

export type ParticipantPortalStatus =
  | "pending"
  | "approved"
  | "withdrawn"
  | "completed";

export const participantPortalStatusLabels: Record<
  ParticipantPortalStatus,
  string
> = {
  pending: "待审核",
  approved: "已获得参与资格",
  withdrawn: "已撤回",
  completed: "已完成",
};

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

export type PortalProfile = {
  creditName: string;
  contactEmail: string;
  primaryContactChannel: string;
  primaryContactHandle: string;
  backupContact: string | null;
  isAnonymous: boolean;
  updatedAt: string;
};

export type PortalApplicationSummary = {
  id: string;
  displayName: string;
  contactEmail: string;
  contactHandle: string | null;
  interestFormat: ApplicationInterestFormat;
  status: ApplicationStatus;
  updatedAt: string;
  reviewedAt: string | null;
};

export type PortalApplicationDetail = PortalApplicationSummary & {
  introText: string | null;
  portfolioUrl: string | null;
  messageToHosts: string | null;
  adminNote: string | null;
  reviewedBy: string | null;
};

export const portalSegmentStatusSchema = z.enum([
  "open",
  "held",
  "locked",
  "released",
  "completed",
]);

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

export type PortalSessionSummary = {
  user: PortalAuthUserSummary;
  participant: PortalParticipantSummary | null;
  profile: PortalProfile | null;
  application: PortalApplicationSummary | null;
};

export type PortalExistingParticipantSummary = Omit<
  PortalSessionSummary,
  "participant"
> & {
  participant: PortalParticipantSummary;
};

export type PortalMeResponse = PortalSessionSummary;

export type PortalDashboardResponse = PortalSessionSummary & {
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

export type PortalCurrentSegmentResponse = PortalExistingParticipantSummary & {
  currentSegment: PortalSegmentSummary | null;
  actions: PortalSegmentActionState;
  windows: EventWindowSummary[];
};

export type PortalProjectResponse = PortalExistingParticipantSummary & {
  draft: PortalProjectDraftDetail;
  windows: EventWindowSummary[];
};

export type PortalHistoryResponse = PortalExistingParticipantSummary & {
  items: PortalEventItem[];
};

export type PortalProfileResponse = PortalSessionSummary & {
  profile: PortalProfile | null;
};

export type PortalProfileMutationResponse = {
  ok: true;
  message: string;
  profile: PortalProfile;
};

export type PortalApplicationResponse = PortalSessionSummary & {
  application: PortalApplicationDetail | null;
  editable: boolean;
  editState: "create" | "update" | "locked";
  message: string | null;
};

export type PortalApplicationMutationResponse = {
  ok: true;
  message: string;
  application: PortalApplicationDetail;
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

export const updatePortalProfileInputSchema = z.object({
  creditName: z.string().trim().min(1, "请填写署名。").max(80),
  isAnonymous: z.boolean(),
  contactEmail: z.string().trim().email().max(320),
  primaryContactChannel: z.string().trim().min(1).max(40),
  primaryContactHandle: z.string().trim().min(1).max(120),
  backupContact: z.string().trim().max(160).optional(),
});

export type UpdatePortalProfileInput = z.infer<
  typeof updatePortalProfileInputSchema
>;

export const updatePortalProjectPreviewInputSchema = z.object({
  previewTitle: z.string().trim().max(120).optional(),
  previewSummary: z.string().trim().max(1600).optional(),
  formatLabel: z.string().trim().max(80).optional(),
  publicTags: z.array(z.string().trim().min(1).max(32)).max(12).optional(),
});

export type UpdatePortalProjectPreviewInput = z.infer<
  typeof updatePortalProjectPreviewInputSchema
>;

export const updatePortalProjectReviewInputSchema = z.object({
  contentNote: z.string().trim().max(2000).optional(),
  contentWarnings: z.string().trim().max(800).optional(),
  reviewNote: z.string().trim().max(2000).optional(),
});

export type UpdatePortalProjectReviewInput = z.infer<
  typeof updatePortalProjectReviewInputSchema
>;

export type PortalProjectMutationResponse = {
  ok: true;
  message: string;
  draft: PortalProjectDraftDetail;
};
