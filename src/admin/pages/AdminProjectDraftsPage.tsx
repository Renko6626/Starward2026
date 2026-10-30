import { Link, getRouteApi } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Button, ReadError, PageHeading, StateNotice } from '../../app/components/ui';
import { requestJson } from '../../app/lib/api';
import { formatDateTime } from '../../app/lib/format';
import { workTypeLabels } from '../../shared/works';
import { workReviewStatusLabels } from '../../shared/work-submissions';
import { participantPortalStatusLabels } from '../../shared/portal';
import type { AdminProjectDraftListItem, AdminProjectDraftListResponse } from '../../shared/admin';
import { matchesProjectScope, summarizeProjectProgress } from '../lib/project-progress';

export const submissionScopes = { unapproved:'已交稿未通过', all:'全部作品', 'not-submitted':'未提交', pending:'待审核', 'changes-requested':'需修改', approved:'已通过', rejected:'未通过', updated:'审核后更新' } as const;
export type SubmissionScope = keyof typeof submissionScopes;
export function AdminProjectDraftsPage() {
  const route = getRouteApi('/portal_/admin/project-drafts/');
  const { scope = 'unapproved',q = '' } = route.useSearch();
  const navigate = route.useNavigate();
  const [data,setData] = useState<AdminProjectDraftListResponse | null>(null), [error,setError] = useState<string | null>(null);
  const [opening,setOpening] = useState<string | null>(null);
  useEffect(() => { let cancelled = false; void requestJson<AdminProjectDraftListResponse>('/api/admin/project-drafts').then(value => {if (!cancelled) setData(value);}).catch(err => {if (!cancelled) setError(err.message);}); return () => {cancelled=true;}; }, []);
  const items = data?.items.filter(item => matchesProjectScope(item, scope) &&
    [item.participantName,item.latestSubmission?.title,item.segmentCode].join(' ').toLowerCase().includes(q.toLowerCase())) ?? [];
  const progress = summarizeProjectProgress(data?.items ?? []);
  async function open(item: AdminProjectDraftListItem) {
    setOpening(item.participantId); setError(null);
    try {
      const id = item.id ?? (await requestJson<{draftId:string}>(`/api/admin/participants/${item.participantId}/project-draft`)).draftId;
      await navigate({to:'/portal/admin/project-drafts/$draftId',params:{draftId:id},search:{scope,q}});
    } catch (err) { setError(err instanceof Error ? err.message : '无法打开作品。'); }
    finally { setOpening(null); }
  }
  return <div className="page-content"><PageHeading title="作品审核" description="优先查看已交稿、尚未通过的作品，可切换范围查看全部作者。">
    <p>已提交 {progress.submitted} 份，未提交 {progress.drafts} 位</p></PageHeading>
    <div className="flex flex-wrap gap-3 mb-6"><label>作品范围<select className="field-input" aria-label="作品范围" value={scope} onChange={e => void navigate({search:{scope:e.target.value as SubmissionScope,q},replace:true})}>{Object.entries(submissionScopes).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>搜索作品<input className="field-input" type="search" aria-label="搜索作品" placeholder="作者、标题或时点" value={q} onChange={e => void navigate({search:{scope,q:e.target.value},replace:true})} /></label></div>
    {error ? <ReadError message={error} /> : null}{!data ? <StateNotice message="正在读取作品。" /> : !items.length ? <StateNotice message="当前筛选下没有作品。" /> :
      <div className="table-frame"><div className="table-scroll" tabIndex={0} role="region" aria-label="作品列表"><table className="data-table admin-compact-table"><thead><tr><th>作者与排期</th><th>最新作品</th><th>审核状态</th><th>操作</th></tr></thead><tbody>
        {items.map(item => <tr key={item.participantId}><td><strong>{item.participantName}</strong><div>{item.segmentCode ?? '尚未分配时点'}</div><small>参与资格：{participantPortalStatusLabels[item.participantStatus]}</small></td>
          <td>{item.latestSubmission ? <><strong>{item.latestSubmission.title}</strong><div>{workTypeLabels[item.latestSubmission.workType]}，V{item.latestSubmission.versionNumber}</div><small>{formatDateTime(item.latestSubmission.submittedAt)}</small></> : <span>尚未正式提交{item.workFileCount ? '（有暂存文件）' : ''}</span>}</td>
          <td><strong>{workReviewStatusLabels[item.review.status]}</strong>{item.review.decisionVersionNumber ? <div>结论依据 V{item.review.decisionVersionNumber}</div> : null}{item.review.hasUpdatesAfterReview ? <div className="text-primary">审核后有更新</div> : null}</td>
          <td>{['approved','completed'].includes(item.participantStatus) ? <Button appearance="industrial" disabled={opening !== null} onClick={() => void open(item)}>{opening === item.participantId ? '读取中…' : '查看作品'}</Button> : <Link className="text-link" to="/portal/admin/participants/$participantId" params={{participantId:item.participantId}}>查看参与资料</Link>}</td></tr>)}
      </tbody></table></div></div>}</div>;
}
