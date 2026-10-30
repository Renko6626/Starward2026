import { useEffect, useState, type FormEvent } from 'react';
import { requestJson } from '../../app/lib/api';
import { Button, Notice } from '../../app/components/ui';
import { formatDateTime } from '../../app/lib/format';
import { workTypeLabels, type WorkType } from '../../shared/works';
import { workReviewStatusLabels, type WorkSubmissionDetail, type WorkSubmissionWorkspace, type WorkSubmissionMutationResult } from '../../shared/work-submissions';
import { WorkFilesSection } from './WorkFilesSection';

const endpoint = '/api/portal/project/submissions';
export function WorkSubmissionSection({ workspace, loadError, onRefresh, initialSummary = '' }: {
  workspace: WorkSubmissionWorkspace | null; loadError: string | null; onRefresh: () => Promise<void>; initialSummary?: string;
}) {
  const [title,setTitle] = useState(''), [summary,setSummary] = useState(''), [workType,setWorkType] = useState<WorkType>('other');
  const [uploadFailed,setUploadFailed] = useState(false);
  const [note,setNote] = useState(''), [busy,setBusy] = useState(false), [uploading,setUploading] = useState(false);
  const [files,setFiles] = useState(workspace?.pendingFiles ?? []);
  const [message,setMessage] = useState<string | null>(null), [error,setError] = useState<string | null>(null);
  const [history,setHistory] = useState<WorkSubmissionDetail | null>(null);
  const [loadingHistory,setLoadingHistory] = useState(false);
  const latestId = workspace?.latest?.id;
  useEffect(() => {
    setTitle(workspace?.latest?.title ?? ''); setSummary(workspace?.latest?.summary ?? initialSummary);
    setWorkType(workspace?.latest?.workType ?? 'other'); setNote('');
    // Only a newly submitted version resets the metadata draft.
  }, [latestId, initialSummary]);
  useEffect(() => { setFiles(workspace?.pendingFiles ?? []); }, [workspace]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || uploading || uploadFailed || !files.length) return; setBusy(true); setError(null); setMessage(null);
    try {
      const result = await requestJson<WorkSubmissionMutationResult>(endpoint, { method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({title,summary,workType,versionNote:note,fileIds:files.map(file => file.id)}) });
      if (!result.ok) throw new Error(result.message);
      setFiles(result.workspace.pendingFiles); setMessage(result.message);
      try { await onRefresh(); } catch { setError('作品已提交。页面刷新未完成，请使用“刷新状态”查看，勿重复提交。'); }
    } catch (err) { setError(err instanceof Error ? err.message : '提交失败，请稍后重试。'); }
    finally { setBusy(false); }
  }
  async function viewVersion(id: string) {
    setLoadingHistory(true); setError(null);
    try { setHistory(await requestJson<WorkSubmissionDetail>(`${endpoint}/${id}`)); }
    catch (err) { setError(err instanceof Error ? err.message : '无法读取历史版本。'); }
    finally { setLoadingHistory(false); }
  }
  const review = workspace?.review, feedback = workspace?.latestFeedback;
  return <section id="work-submission" className="submission-panel" aria-labelledby="submission-heading">
    <div className="submission-heading"><div><p className="eyebrow">WORK / REVIEW</p><h2 id="submission-heading">作品提交与审核</h2></div>
      {review ? <strong className={`submission-status submission-status--${review.status}`}>{workReviewStatusLabels[review.status]}</strong> : null}</div>
    {workspace ? <>
      <p className="submission-meta">{workspace.latest ? `最新提交 V${workspace.latest.versionNumber}，${formatDateTime(workspace.latest.submittedAt)}` : '尚未正式提交作品。上传文件后，还需点击提交按钮。'}
        {review?.decisionVersionNumber ? `　审核结论依据 V${review.decisionVersionNumber}` : ''}</p>
      {review?.hasUpdatesAfterReview ? <Notice tone="warning">审核后有更新。当前通过结论依据 V{review.decisionVersionNumber}，最新稿尚未复审。</Notice> : null}
      {feedback ? <div className={`submission-feedback${review?.status === 'changes_requested' || review?.status === 'rejected' ? ' submission-feedback--attention' : ''}`}>
        <h3>主催审稿意见</h3><p className="field-hint">针对 V{feedback.versionNumber}，{formatDateTime(feedback.createdAt)}</p><p>{feedback.feedback}</p>
      </div> : <p className="field-hint">主催保存审稿意见后，会直接显示在这里。</p>}
      {workspace.latest ? <div className="submission-version"><h3>最新完整作品 V{workspace.latest.versionNumber}：{workspace.latest.title}</h3><VersionContents version={workspace.latest} /></div> : null}
      <div className="submission-editor"><h3>{workspace.latest ? '提交完整新版本' : '提交完整作品'}</h3>
        <p>每次提交请上传完整的一套作品文件。暂不设置硬性截止，请按接力排期尽早交稿；预计来不及请联系主催。</p>
        <WorkFilesSection data={{files,window:workspace.window}} loadError={null} onFilesChange={update => setFiles(update)} onBusyChange={setUploading} onUploadErrorChange={setUploadFailed} disabled={busy} />
        {uploadFailed ? <Notice tone="warning">本次仍有文件未上传完成，请重新上传未完成的文件后再提交完整作品。</Notice> : null}
        {workspace.window.isOpen ? <form onSubmit={event => void submit(event)} className="submission-form">
          <label>作品标题<input className="field-input" required maxLength={120} value={title} disabled={busy} onChange={e => setTitle(e.target.value)} /></label>
          <label>作品类型<select className="field-input" value={workType} disabled={busy} onChange={e => setWorkType(e.target.value as WorkType)}>{Object.entries(workTypeLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="submission-form-wide">作品简介<textarea className="field-input" required maxLength={1600} rows={3} value={summary} disabled={busy} onChange={e => setSummary(e.target.value)} /></label>
          <label className="submission-form-wide">版本说明（选填，仅本人和主催可见）<textarea className="field-input" maxLength={2000} rows={2} value={note} disabled={busy} placeholder="可以说明查看顺序或本次修改内容。" onChange={e => setNote(e.target.value)} /></label>
          <div className="submission-form-wide"><p className="field-hint">本次将提交上方 {files.length} 个暂存文件。提交后保留该版本，文件不能再删除。</p><Button appearance="framed" className="button--accent" type="submit" disabled={busy || uploading || uploadFailed || !files.length} aria-busy={busy}>{busy ? '提交中…' : workspace.latest ? '提交新版本' : '提交完整作品'}</Button></div>
        </form> : null}
      </div>
      {workspace.versions.length ? <details className="submission-history"><summary>历史版本与意见（{workspace.versions.length} 版）</summary>
        <div className="workspace-actions">{workspace.versions.map(version => <Button key={version.id} appearance="industrial" variant="secondary" disabled={loadingHistory} onClick={() => void viewVersion(version.id)}>V{version.versionNumber}{workspace.firstApprovedSubmission?.id === version.id ? '（首次通过版）' : ''}</Button>)}</div>
        {loadingHistory ? <p>正在读取版本。</p> : history ? <div><h3>V{history.versionNumber}：{history.title}</h3><VersionContents version={history} /></div> : null}
      </details> : null}
      {workspace.legacyFeedback ? <details><summary>历史资料审核意见</summary><p className="submission-note">{workspace.legacyFeedback}</p></details> : null}
    </> : !loadError ? <p>正在读取作品与审核信息。</p> : null}
    {message ? <Notice tone="success">{message}</Notice> : null}
    {error || loadError ? <Notice tone="error">{error || loadError}</Notice> : null}
  </section>;
}

function VersionContents({version}: {version:WorkSubmissionDetail}) {
  return <><p className="submission-note">{version.summary}</p><p className="field-hint">{workTypeLabels[version.workType]}，{formatDateTime(version.submittedAt)}</p>
    {version.versionNote ? <p className="submission-note">版本说明：{version.versionNote}</p> : null}
    <ul className="work-file-list">{version.files.map(file => <li key={file.id}><a href={`/api/portal/project/files/${file.id}/download`} download={file.filename}>{file.filename}</a></li>)}</ul>
    {version.reviews.length ? <div className="submission-review-history"><h4>此版本的审稿记录</h4>{version.reviews.map(review => <div key={review.id}><p className="field-hint">{formatDateTime(review.createdAt)}{review.decision ? `，${workReviewStatusLabels[review.decision]}` : ''}</p><p className="submission-note">{review.feedback || '审核通过。'}</p></div>)}</div> : null}</>;
}
