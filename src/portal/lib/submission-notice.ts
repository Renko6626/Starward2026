import type { WorkReviewStatus, WorkSubmissionWorkspace } from '../../shared/work-submissions';

export type SubmissionNotice = {
  id: string;
  status: WorkReviewStatus;
  title: string;
  description: string;
  steps: string[];
  feedback: string | null;
  primaryLabel: string;
};

export const submissionNoticeStorageKey = (userId: string, draftId: string, noticeId: string) =>
  `starward-submission-notice:${userId}:${draftId}:${noticeId}`;

export function buildSubmissionNotice(workspace: WorkSubmissionWorkspace): SubmissionNotice | null {
  const { review, latest, firstApprovedSubmission, window } = workspace;
  if (review.status === 'not_submitted') return {
    id: 'not-submitted', status: review.status, title: '请提交完整作品',
    description: window.isOpen
      ? '你已通过报名审核，接下来请提交完整作品，供策划组审核内容。已预留的接力时点可在下方查看。'
      : '你还没有正式交稿。投稿入口暂未开放，可以先完成作品，开放后再按以下步骤提交。',
    steps: ['上传完整作品文件，填写作品标题、类型和简介。',
      '上传完整文件后，点击“提交完整作品”，才算正式交稿。',
      '审核结果和策划组的意见会显示在工作台；需要修改时，提交完整修订版。'],
    feedback: null, primaryLabel: window.isOpen ? '去提交作品' : '查看投稿安排',
  };
  if (!latest) return null;
  if (review.status === 'pending') return {
    id: `pending:${latest.id}`, status: review.status, title: '作品已提交，等待策划组审核',
    description: `V${latest.versionNumber}《${latest.title}》已提交。审核结果和策划组的意见会直接显示在工作台。`,
    steps: ['如果需要修改，请按意见上传整套修订稿，再点击“提交新版本”。'],
    feedback: null, primaryLabel: '查看已提交作品',
  };
  if (review.status === 'changes_requested' || review.status === 'rejected') {
    const decision = latest.reviews.find(item => item.decision === review.status);
    return {
      id: `${review.status}:${decision?.id ?? latest.id}`, status: review.status,
      title: review.status === 'changes_requested' ? '策划组请你修改作品' : '本次作品未通过审核',
      description: `策划组已审核 V${review.decisionVersionNumber ?? latest.versionNumber}《${latest.title}》，请先查看下方意见。`,
      steps: ['请按意见修改，再上传完整修订版并提交。原稿和审稿记录都会保留；有疑问可以联系策划组。'],
      feedback: decision?.feedback ?? null, primaryLabel: '查看意见并修改',
    };
  }
  if (!firstApprovedSubmission) return null;
  return {
    id: `approved:${firstApprovedSubmission.id}`, status: 'approved', title: '你的作品已通过审核',
    description: `V${firstApprovedSubmission.versionNumber}《${firstApprovedSubmission.title}》已通过策划组审核。这一版已保留，作为后续修订的审核基准。`,
    steps: ['小幅修订可以继续补交完整版本，沿用已有审核结果；较大的内容改动，请先联系策划组确认是否需要复审。',
      '请按约定的接力时点发布作品。'],
    feedback: null, primaryLabel: '查看作品与审核结果',
  };
}
