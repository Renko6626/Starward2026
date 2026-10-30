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
    id: 'not-submitted', status: review.status, title: '下一步：提交完整作品',
    description: window.isOpen
      ? '报名通过后，还需要正式提交完整作品，供主催进行内容审核。已预留的接力时点可在下方查看。'
      : '你尚未正式交稿。投稿入口暂未开放，可以先完成作品；入口开放后再按以下步骤提交。',
    steps: ['上传完整作品文件，填写作品标题、类型和简介。',
      '上传完整文件后，点击“提交完整作品”，才算正式交稿。',
      '在同一工作台查看审核状态和主催意见；需要修改时，提交完整修订版。'],
    feedback: null, primaryLabel: window.isOpen ? '去提交作品' : '查看投稿安排',
  };
  if (!latest) return null;
  if (review.status === 'pending') return {
    id: `pending:${latest.id}`, status: review.status, title: '作品已收到，等待主催审核',
    description: `你已提交完整作品 V${latest.versionNumber}《${latest.title}》。主催的审核结论和意见会直接显示在工作台。`,
    steps: ['需要修改时，请根据意见上传完整的一套新文件，再点击“提交新版本”。'],
    feedback: null, primaryLabel: '查看已提交作品',
  };
  if (review.status === 'changes_requested' || review.status === 'rejected') {
    const decision = latest.reviews.find(item => item.decision === review.status);
    return {
      id: `${review.status}:${decision?.id ?? latest.id}`, status: review.status,
      title: review.status === 'changes_requested' ? '主催请你修改作品' : '本次作品未通过审核',
      description: `主催已审核 V${review.decisionVersionNumber ?? latest.versionNumber}《${latest.title}》，请先查看下方意见。`,
      steps: ['按意见修改后，上传完整修订版并重新提交；原版本和审稿记录会保留。有疑问可联系主催。'],
      feedback: decision?.feedback ?? null, primaryLabel: '查看意见并修改',
    };
  }
  if (!firstApprovedSubmission) return null;
  return {
    id: `approved:${firstApprovedSubmission.id}`, status: 'approved', title: '你的完整作品已通过审核',
    description: `首次通过的 V${firstApprovedSubmission.versionNumber}《${firstApprovedSubmission.title}》已保留为审核基准。`,
    steps: ['后续小幅修订可以继续提交完整新版本，沿用通过结论；较大内容变更请联系主催确认是否复审。',
      '内容审核通过后，仍需按约定的接力时点发布作品。'],
    feedback: null, primaryLabel: '查看作品与审核结果',
  };
}
