import { z } from 'zod';
import { workTypeSchema, type WorkType } from './works';
import type { WorkFile } from './work-files';
import type { EventWindowSummary } from './windows';

export type WorkReviewStatus = 'not_submitted' | 'pending' | 'changes_requested' | 'approved' | 'rejected';
export const workReviewStatusLabels: Record<WorkReviewStatus, string> = {
  not_submitted: '未提交', pending: '待审核', changes_requested: '需修改', approved: '已通过', rejected: '未通过',
};
const decisionSchema = z.enum(['approved', 'changes_requested', 'rejected']);
export type WorkReviewDecision = z.infer<typeof decisionSchema>;
export const createWorkSubmissionSchema = z.object({
  title: z.string().trim().min(1, '请填写作品标题。').max(120),
  workType: workTypeSchema,
  summary: z.string().trim().min(1, '请填写作品简介。').max(1600),
  versionNote: z.string().trim().max(2000).optional(),
  fileIds: z.array(z.string().min(1).max(64)).min(1, '请上传完整作品文件。')
    .refine(ids => new Set(ids).size === ids.length, '文件不能重复。'),
});
export const createWorkSubmissionReviewSchema = z.object({
  feedback: z.string().trim().max(2000).optional(), decision: decisionSchema.optional(),
}).refine(input => input.decision === 'approved' || Boolean(input.feedback?.trim()), '请填写审稿意见；需修改或未通过时必须说明理由。');
export type CreateWorkSubmissionInput = z.infer<typeof createWorkSubmissionSchema>;
export type CreateWorkSubmissionReviewInput = z.infer<typeof createWorkSubmissionReviewSchema>;
export type WorkSubmissionSummary = {
  id: string; versionNumber: number; title: string; workType: WorkType;
  summary: string; versionNote: string | null; submittedAt: string; fileCount: number;
};
export type WorkSubmissionReview = {
  id: number; submissionId: string; versionNumber: number; feedback: string | null;
  decision: WorkReviewDecision | null; createdAt: string;
};
export type WorkSubmissionDetail = WorkSubmissionSummary & { files: WorkFile[]; reviews: WorkSubmissionReview[] };
export type WorkReviewSummary = {
  status: WorkReviewStatus; decisionSubmissionId: string | null;
  decisionVersionNumber: number | null; hasUpdatesAfterReview: boolean;
};
export type WorkSubmissionWorkspace = {
  draftId: string; review: WorkReviewSummary; latest: WorkSubmissionDetail | null;
  firstApprovedSubmission: WorkSubmissionSummary | null; versions: WorkSubmissionSummary[];
  latestFeedback: WorkSubmissionReview | null; pendingFiles: WorkFile[];
  window: EventWindowSummary; legacyFeedback: string | null;
};
export type WorkSubmissionMutationResult = { ok: true; workspace: WorkSubmissionWorkspace; message: string }
  | { ok: false; status: number; code: string; message: string };

export function summarizeWorkReview(latestVersion: number | null,
  lastDecision: { submissionId: string; versionNumber: number; decision: WorkReviewDecision } | null): WorkReviewSummary {
  const newer = Boolean(latestVersion && lastDecision && latestVersion > lastDecision.versionNumber);
  return {
    status: latestVersion === null ? 'not_submitted' : !lastDecision || newer && lastDecision.decision !== 'approved' ? 'pending' : lastDecision.decision,
    decisionSubmissionId: lastDecision?.submissionId ?? null,
    decisionVersionNumber: lastDecision?.versionNumber ?? null,
    hasUpdatesAfterReview: newer && lastDecision?.decision === 'approved',
  };
}
