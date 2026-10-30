import { useEffect, useState, type FormEvent } from 'react';
import { requestJson } from '../../app/lib/api';
import { Button, Notice } from '../../app/components/ui';
import { formatDateTime } from '../../app/lib/format';
import { workTypeLabels, type WorkType } from '../../shared/works';
import { workReviewStatusLabels, type WorkSubmissionDetail, type WorkSubmissionWorkspace, type WorkSubmissionMutationResult } from '../../shared/work-submissions';
import { WorkFilesSection } from './WorkFilesSection';
import { formatWorkFileSize } from '../../shared/work-files';
import { SubmissionStatusNotice } from './SubmissionStatusNotice';

const endpoint = '/api/portal/project/submissions';
export function WorkSubmissionSection({ userId, workspace, loadError, onRefresh, initialSummary = '' }: {
  userId: string; workspace: WorkSubmissionWorkspace | null; loadError: string | null; onRefresh: () => Promise<void>; initialSummary?: string;
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
    <div className="submission-heading"><h2 id="submission-heading" tabIndex={-1}>作品提交与审核</h2>
      <div className="submission-heading-actions">{review ? <strong className={`submission-status submission-status--${review.status}`}>{workReviewStatusLabels[review.status]}</strong> : null}
        {workspace ? <SubmissionStatusNotice userId={userId} workspace={workspace} /> : null}</div></div>
    {workspace ? <>
      <p className="submission-meta">{workspace.latest ? `最新提交 V${workspace.latest.versionNumber}，${formatDateTime(workspace.latest.submittedAt)}` : '上传完整作品并提交后，策划组即可审核。'}
        {review?.decisionVersionNumber ? `　审核结论依据 V${review.decisionVersionNumber}` : ''}</p>
      {review?.hasUpdatesAfterReview ? <Notice tone="warning">审核后有更新。当前通过结论依据 V{review.decisionVersionNumber}，最新稿尚未复审。</Notice> : null}
      {feedback ? <div className={`submission-feedback${review?.status === 'changes_requested' || review?.status === 'rejected' ? ' submission-feedback--attention' : ''}`}>
        <div className="submission-feedback-heading"><h3>策划组审稿意见</h3><span className="field-hint">V{feedback.versionNumber}，{formatDateTime(feedback.createdAt)}</span></div><p>{feedback.feedback}</p>
      </div> : null}
      {workspace.latest ? <div className="submission-version"><div className="submission-version-heading"><h3>{workspace.latest.title}</h3><span className="field-hint">{workTypeLabels[workspace.latest.workType]}，V{workspace.latest.versionNumber}</span></div><VersionContents version={workspace.latest} compact /></div> : null}
      <details key={latestId ?? 'first-submission'} className="submission-editor" open={!workspace.latest}>
        <summary>{workspace.latest ? '提交修订版' : '提交完整作品'}{workspace.latest && files.length ? <span className="field-hint">已有 {files.length} 个暂存文件</span> : null}</summary>
        <div className="submission-editor-body"><p className="field-hint">每次提交完整的一套文件，暂不设硬性截止；预计赶不上排期请联系策划组。</p>
        <WorkFilesSection data={{files,window:workspace.window}} loadError={null} onFilesChange={update => setFiles(update)} onBusyChange={setUploading} onUploadErrorChange={setUploadFailed} disabled={busy} />
        {uploadFailed ? <Notice tone="warning">本次仍有文件未上传完成，请重新上传未完成的文件后再提交完整作品。</Notice> : null}
        {workspace.window.isOpen ? <form onSubmit={event => void submit(event)} className="submission-form">
          <div className="submission-form-heading submission-form-wide">
          <label>作品标题<input className="field-input" required maxLength={120} value={title} disabled={busy} onChange={e => setTitle(e.target.value)} /></label>
          <label>作品类型<select className="field-input" value={workType} disabled={busy} onChange={e => setWorkType(e.target.value as WorkType)}>{Object.entries(workTypeLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          <label>作品简介<textarea className="field-input submission-summary-input" required maxLength={1600} rows={3} value={summary} disabled={busy} onChange={e => setSummary(e.target.value)} /></label>
          <label>版本说明（选填，仅本人和策划组可见）<textarea className="field-input submission-version-note-input" maxLength={2000} rows={2} value={note} disabled={busy} placeholder="可以说明查看顺序或本次修改内容。" onChange={e => setNote(e.target.value)} /></label>
          <div className="submission-form-wide submission-submit-row"><p className="field-hint">本次提交 {files.length} 个文件，提交后保留该版本。</p><Button appearance="framed" className="button--accent" type="submit" disabled={busy || uploading || uploadFailed || !files.length} aria-busy={busy}>{busy ? '提交中…' : workspace.latest ? '提交新版本' : '提交完整作品'}</Button></div>
        </form> : null}
        </div>
      </details>
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

function VersionContents({version, compact = false}: {version:WorkSubmissionDetail; compact?:boolean}) {
  if (compact) return <>
    <ul className="work-file-list">{version.files.map(file => <li key={file.id}><a href={`/api/portal/project/files/${file.id}/download`} download={file.filename}>{file.filename}</a><span>{formatWorkFileSize(file.size)}</span></li>)}</ul>
    <details className="submission-version-notes"><summary>查看简介与版本说明</summary><p className="submission-note">{version.summary}</p>{version.versionNote ? <p className="submission-note">版本说明：{version.versionNote}</p> : null}</details>
  </>;
  return <><p className="submission-note">{version.summary}</p><p className="field-hint">{workTypeLabels[version.workType]}，{formatDateTime(version.submittedAt)}</p>
    {version.versionNote ? <p className="submission-note">版本说明：{version.versionNote}</p> : null}
    <ul className="work-file-list">{version.files.map(file => <li key={file.id}><a href={`/api/portal/project/files/${file.id}/download`} download={file.filename}>{file.filename}</a></li>)}</ul>
    {version.reviews.length ? <div className="submission-review-history"><h4>此版本的审稿记录</h4>{version.reviews.map(review => <div key={review.id}><p className="field-hint">{formatDateTime(review.createdAt)}{review.decision ? `，${workReviewStatusLabels[review.decision]}` : ''}</p><p className="submission-note">{review.feedback || '审核通过。'}</p></div>)}</div> : null}</>;
}
