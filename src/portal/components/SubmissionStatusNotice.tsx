import { X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../app/components/ui';
import { useDialogMotion } from '../../app/components/use-dialog-motion';
import { workReviewStatusLabels, type WorkSubmissionWorkspace } from '../../shared/work-submissions';
import { buildSubmissionNotice, submissionNoticeStorageKey, type SubmissionNotice } from '../lib/submission-notice';

export function SubmissionStatusNotice({ userId, workspace }: { userId: string; workspace: WorkSubmissionWorkspace }) {
  const notice = useMemo(() => buildSubmissionNotice(workspace), [workspace]);
  const storageKey = notice ? submissionNoticeStorageKey(userId, workspace.draftId, notice.id) : null;
  const [active, setActive] = useState<{ key: string; notice: SubmissionNotice } | null>(null);
  const dismissed = useRef(new Set<string>());
  const previousFocus = useRef<HTMLElement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const { enter, exit, stop } = useDialogMotion(dialog);
  const id = useId();
  const open = active !== null;

  useEffect(() => {
    if (!notice || !storageKey) return;
    let seen = dismissed.current.has(storageKey);
    try { seen ||= localStorage.getItem(storageKey) === 'seen'; } catch { /* Keep the notice usable when browser storage is disabled. */ }
    if (seen) {
      setActive(current => current?.key === storageKey ? current : null);
    } else {
      setActive(current => current?.key === storageKey ? current : { key: storageKey, notice });
    }
  }, [notice, storageKey]);

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    enter();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      stop();
      if (element.open) element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open, enter, stop]);

  function close(goToWork = false) {
    if (!active) return;
    const key = active.key;
    exit(() => {
      dismissed.current.add(key);
      try { localStorage.setItem(key, 'seen'); } catch { /* Remember dismissal for this mounted workspace. */ }
      dialog.current?.close();
      setActive(null);
      if (goToWork) {
        document.getElementById('submission-heading')?.focus({ preventScroll: true });
        document.getElementById('work-submission')?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      } else previousFocus.current?.focus({ preventScroll: true });
    });
  }

  if (!notice || !storageKey) return null;
  return <>
    <button className="text-link submission-notice-trigger" type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => setActive({ key: storageKey, notice })}>流程与状态说明</button>
    {active ? createPortal(<dialog ref={dialog} id={id} className="login-password-dialog submission-status-dialog"
      aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      onCancel={event => { event.preventDefault(); close(); }} onClose={() => setActive(null)}>
      <header className="submission-status-dialog-header">
        <span className={`submission-status submission-status--${active.notice.status}`}>{workReviewStatusLabels[active.notice.status]}</span>
        <button className="icon-button" type="button" aria-label="关闭流程与状态说明" onClick={() => close()}><X size={20} /></button>
      </header>
      <div className="submission-status-dialog-body">
        <h2 id={`${id}-title`}>{active.notice.title}</h2>
        <p className="submission-stage-message">DDL 临近，活动即将进入下一阶段。请留意后续安排，并在工作台查看交稿状态和审核意见。</p>
        <p id={`${id}-description`}>{active.notice.description}</p>
        {active.notice.feedback ? <div className="submission-status-dialog-feedback"><h3>策划组审稿意见</h3><p>{active.notice.feedback}</p></div> : null}
        {active.notice.steps.length ? <ol>{active.notice.steps.map(step => <li key={step}>{step}</li>)}</ol> : null}
      </div>
      <footer className="submission-status-dialog-actions">
        <Button appearance="industrial" variant="secondary" onClick={() => close()}>我知道了</Button>
        <Button appearance="framed" className="button--accent" autoFocus onClick={() => close(true)}>{active.notice.primaryLabel}</Button>
      </footer>
    </dialog>, document.body) : null}
  </>;
}
