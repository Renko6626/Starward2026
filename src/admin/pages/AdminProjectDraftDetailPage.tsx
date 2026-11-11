import { Link, getRouteApi, useSearch } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Notice, PageHeading, ReadError } from '../../app/components/ui';
import { requestJson } from '../../app/lib/api';
import { formatDateTime } from '../../app/lib/format';
import { AdminWorkPresentation } from '../components/AdminWorkPresentation';
import { workTypeLabels } from '../../shared/works';
import { workReviewStatusLabels, type WorkSubmissionDetail, type WorkSubmissionWorkspace, type WorkSubmissionMutationResult, type WorkReviewDecision } from '../../shared/work-submissions';
import type { AdminProjectDraftDetailResponse } from '../../shared/admin';
import { AdminWorkFiles } from '../components/AdminWorkFiles';
import type { SubmissionScope } from './AdminProjectDraftsPage';

const route = getRouteApi('/portal_/admin/project-drafts/$draftId');
export function AdminProjectDraftDetailPage() {
  const {draftId} = route.useParams();
  const search = useSearch({strict:false}) as {scope?:SubmissionScope;q?:string};
  const [data,setData] = useState<AdminProjectDraftDetailResponse | null>(null), [workspace,setWorkspace] = useState<WorkSubmissionWorkspace | null>(null);
  const [version,setVersion] = useState<WorkSubmissionDetail | null>(null), [feedback,setFeedback] = useState('');
  const [decision,setDecision] = useState<WorkReviewDecision | ''>(''), [busy,setBusy] = useState(false);
  const [error,setError] = useState<string | null>(null), [message,setMessage] = useState<string | null>(null);
  const [contactMessage,setContactMessage] = useState<string | null>(null);
  const endpoint = `/api/admin/project-drafts/${draftId}`;
  useEffect(() => {
    let cancelled = false; setData(null);setWorkspace(null);setVersion(null);setError(null);setMessage(null);setContactMessage(null);setFeedback('');setDecision('');
    void Promise.all([requestJson<AdminProjectDraftDetailResponse>(endpoint),requestJson<WorkSubmissionWorkspace>(`${endpoint}/submissions`)]).then(([detail,work]) => {if (!cancelled) {setData(detail);setWorkspace(work);setVersion(work.latest);}}).catch(err => {if (!cancelled) setError(err.message);});
    return () => {cancelled=true;};
  },[endpoint]);
  async function copyContact() {
    if (!data?.draft.participantContactHandle) return;
    try {
      await navigator.clipboard.writeText(data.draft.participantContactHandle);
      setContactMessage('已复制联系方式。');
    } catch {
      setContactMessage('复制失败，请选中联系方式手动复制。');
    }
  }
  async function choose(id:string) {
    setBusy(true);setError(null);
    try {setVersion(await requestJson<WorkSubmissionDetail>(`${endpoint}/submissions/${id}`));setFeedback('');setDecision('');}
    catch (err) {setError(err instanceof Error ? err.message : '无法读取版本。');} finally {setBusy(false);}
  }
  async function review(event:FormEvent) {
    event.preventDefault(); if (!version) return; setBusy(true);setError(null);setMessage(null);
    try {
      const result = await requestJson<WorkSubmissionMutationResult>(`${endpoint}/submissions/${version.id}/reviews`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({feedback,decision:decision || undefined})});
      if (!result.ok) throw new Error(result.message);
      setWorkspace(result.workspace);setFeedback('');setDecision('');setMessage(result.message);
      setVersion(version.id === result.workspace.latest?.id ? result.workspace.latest : await requestJson<WorkSubmissionDetail>(`${endpoint}/submissions/${version.id}`));
      setData(await requestJson<AdminProjectDraftDetailResponse>(endpoint));
    } catch (err) {setError(err instanceof Error ? err.message : '保存失败。');} finally {setBusy(false);}
  }
  const latest = version?.id === workspace?.latest?.id;
  return <div className="page-content submission-admin-detail"><Link className="text-link" to="/portal/admin/project-drafts" search={search}>返回作品列表</Link><PageHeading title={data ? `${data.draft.participantName}的作品审核` : '作品审核详情'} />
    {error ? <ReadError message={error} /> : null}{message ? <Notice tone="success">{message}</Notice> : null}
    {!data || !workspace ? !error ? <p>正在读取作品。</p> : null : <>
      <section className="panel space-y-3" aria-labelledby="review-author-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="review-author-heading">作者联系</h2>
          <Link className="text-link" to="/portal/admin/participants/$participantId" params={{participantId:data.draft.participantId}}>查看作者完整资料</Link>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="field-hint">作者署名</dt><dd className="break-all select-text">{data.draft.participantName}</dd></div>
          <div><dt className="field-hint">联系方式</dt><dd className="break-all select-text">{data.draft.participantContactHandle || '未填写'}</dd>
            {data.draft.participantContactHandle ? <button type="button" className="text-link" onClick={() => void copyContact()}>复制联系方式</button> : null}
          </div>
          <div><dt className="field-hint">联系邮箱</dt><dd className="break-all select-text">{data.draft.participantInviteEmail ? <a className="text-link" href={`mailto:${data.draft.participantInviteEmail}`}>{data.draft.participantInviteEmail}</a> : '未填写'}</dd></div>
          <div><dt className="field-hint">接力编号</dt><dd>{data.draft.segmentCode || '尚未安排'}</dd></div>
        </dl>
        {contactMessage ? <p className="field-hint" role="status">{contactMessage}</p> : null}
      </section>
      <section className="panel space-y-3"><h2>{workReviewStatusLabels[workspace.review.status]}</h2><p>最新提交：{workspace.latest ? `V${workspace.latest.versionNumber}，${formatDateTime(workspace.latest.submittedAt)}` : '尚未正式提交'}{workspace.review.decisionVersionNumber ? `；结论依据 V${workspace.review.decisionVersionNumber}` : ''}</p>
        {workspace.review.hasUpdatesAfterReview ? <Notice tone="warning">审核后有更新，当前通过结论不代表最新版本已复审。</Notice> : null}
        {workspace.versions.length ? <label>查看作品版本<select className="field-input" value={version?.id ?? ''} disabled={busy} onChange={e => void choose(e.target.value)}>{workspace.versions.map(v => <option key={v.id} value={v.id}>V{v.versionNumber}：{v.title}{workspace.firstApprovedSubmission?.id === v.id ? '（首次通过版）' : ''}</option>)}</select></label> : <p>作者尚未正式交稿。上传暂存文件不计为提交。</p>}
      </section>
      {version ? <div className="grid gap-4 lg:grid-cols-2"><section className="panel space-y-3"><h2>V{version.versionNumber}：{version.title}</h2><p>{workTypeLabels[version.workType]}，{formatDateTime(version.submittedAt)}</p><p className="submission-note">{version.summary}</p>{version.versionNote ? <p className="submission-note">版本说明：{version.versionNote}</p> : null}
        <AdminWorkFiles draftId={draftId} files={version.files} />
        <h3>此版本审稿记录</h3>{version.reviews.length ? version.reviews.map(item => <div key={item.id} className="submission-feedback"><p className="field-hint">{formatDateTime(item.createdAt)}{item.decision ? `，${workReviewStatusLabels[item.decision]}` : ''}</p><p className="submission-note">{item.feedback || '审核通过。'}</p></div>) : <p>尚无审稿记录。</p>}
      </section><section className="panel space-y-3"><h2>针对 V{version.versionNumber} 写审稿意见</h2><p>保存后作者立即可见。</p><form className="space-y-3" onSubmit={e => void review(e)}>
        <label className="block">审稿意见<textarea className="field-input" rows={4} maxLength={2000} value={feedback} disabled={busy} onChange={e => setFeedback(e.target.value)} required={decision !== 'approved'} /></label>
        <label className="block">审核结论<select className="field-input" disabled={busy || !latest} value={decision} onChange={e => setDecision(e.target.value as WorkReviewDecision | '')}><option value="">仅保存意见，不改变结论</option><option value="approved">已通过</option><option value="changes_requested" disabled={Boolean(data.draft.publishedAt)}>需修改</option><option value="rejected" disabled={Boolean(data.draft.publishedAt)}>未通过</option></select></label>
        {data.draft.publishedAt ? <p>意见可继续保存；需修改或未通过请先撤下公开作品。</p> : null}
        {!latest ? <p>历史版本可追加意见，请切换到最新版本修改当前结论。</p> : null}
        <Button appearance="industrial" type="submit" disabled={busy}>{busy ? '保存中…' : '保存审稿意见'}</Button>
      </form></section></div> : null}
      {workspace.legacyFeedback ? <details className="panel"><summary>历史资料审核意见</summary><p className="submission-note">{workspace.legacyFeedback}</p></details> : null}
      {data.presentationSegmentId ? <AdminWorkPresentation key={data.presentationSegmentId} segmentId={data.presentationSegmentId}
        initialTitle={workspace.latest?.title ?? data.draft.previewTitle ?? ''} initialSummary={workspace.latest?.summary ?? data.draft.previewSummary ?? ''}
        authorName={data.draft.publicAuthorName ?? data.draft.participantName}
        onSaved={async()=>{setData(await requestJson<AdminProjectDraftDetailResponse>(endpoint));}}/>
        : <section className="panel"><h2>展示资料</h2><p>请先在排期中为作者安排坑位，再准备展示资料。</p></section>}
    </>}
  </div>;
}
