import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Button, Field, Notice } from "../../app/components/ui";
import { requestJson } from "../../app/lib/api";
import { formatScheduledTime } from "../../app/lib/format";
import type { PortalProjectMutationResponse, PortalProjectResponse } from "../../shared/portal";
import { getRelayPublicationState } from "../../shared/relay-publication";

export function RelayPublicationNotice({ revision, onSaved }: { revision: number; onSaved: () => Promise<void> }) {
  const [project, setProject] = useState<PortalProjectResponse | null>(null);
  const [workUrl, setWorkUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const dirty = useRef(false);
  const sequence = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const request = ++sequence.current;
      try {
        const next = await requestJson<PortalProjectResponse>("/api/portal/project");
        if (cancelled || request !== sequence.current) return;
        setProject(next);
        if (!dirty.current) setWorkUrl(next.draft.workUrl ?? "");
      } catch (caught) {
        if (!cancelled && request === sequence.current) setError(caught instanceof Error ? caught.message : "暂时无法读取发布安排。");
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    return () => { cancelled = true; sequence.current += 1; window.clearInterval(timer); };
  }, [revision]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(null); setMessage(null);
    sequence.current += 1;
    try {
      const response = await requestJson<PortalProjectMutationResponse>("/api/portal/project/release", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workUrl }),
      });
      sequence.current += 1;
      dirty.current = false;
      setWorkUrl(response.draft.workUrl ?? "");
      setProject(current => current ? { ...current, draft: response.draft,
        release: getRelayPublicationState(current.release.scheduledAt, response.draft.releaseConfirmedAt) } : current);
      setMessage(response.message);
      await onSaved().catch(() => setError("链接已保存，页面暂未更新，请点击“刷新状态”。"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "确认发布失败，请稍后重试。");
    } finally { setBusy(false); }
  }

  if (!project) return error ? <Notice tone="warning">{error}</Notice> : null;
  const { release, draft } = project;
  const title = release.phase === "confirmed" ? "你已确认发布"
    : release.phase === "today" ? "今天轮到你发布"
    : release.phase === "overdue" ? "你的发布时间已过，尚未确认发布"
    : release.phase === "unconfigured" ? "你的发布时间尚未安排"
    : `距你的发布还有 ${release.remainingDays} 天`;
  if (release.phase === "upcoming" && !release.showReminder) return error ? <Notice tone="warning">{error}</Notice> : null;
  return <section className={`relay-publication-notice${release.showReminder ? " is-due" : ""}`} aria-labelledby="relay-publication-title">
    <div className="relay-publication-heading"><h2 id="relay-publication-title">{title}</h2>
      {release.scheduledAt ? <p>约定发布时间：{formatScheduledTime(release.scheduledAt)}（北京时间）</p> : null}
    </div>
    {release.phase === "confirmed" ? <p>确认时间：{formatScheduledTime(release.confirmedAt)}。修改链接不会取消发布确认。</p>
      : release.phase === "today" ? <p>请按约定时刻发布作品，再于今天填写公开链接，点击“确认已发布”。</p>
      : release.phase === "overdue" ? <p>已错过当天确认，请联系主催协调。</p>
      : release.phase === "unconfigured" ? <p>请联系主催安排发布时间。</p>
      : <p>按截止时间完成并提交作品。发布当天再填写公开链接并确认。</p>}
    {release.canEditLink ? <form className="relay-publication-form" onSubmit={event => void save(event)}>
      <Field label="作品链接">
        <input className="field-input" type="url" required maxLength={2048} value={workUrl} disabled={busy}
          placeholder="公开可访问的 HTTPS 作品链接，确认后仍可修改" onChange={event => { dirty.current = true; setWorkUrl(event.target.value); }} />
      </Field>
      <div className="archive-control"><span className="archive-control-label" aria-hidden="true">RELEASE / {release.confirmedAt ? "SAVE" : "CONFIRM"}</span><Button appearance={release.confirmedAt ? "industrial" : "framed"} className={release.confirmedAt ? undefined : "button--accent"} type="submit" disabled={busy || !workUrl.trim()} aria-busy={busy}>{busy ? "提交中…" : release.confirmedAt ? "保存作品链接" : "确认已发布"}</Button></div>
    </form> : null}
    {release.confirmedAt ? draft.publishedAt
      ? <Link className="text-link" to="/works/$workId" params={{ workId: draft.id }}>查看公开作品</Link>
      : <p className="field-hint">已确认发布。作品预告和审查说明通过审核、公开资料齐全后，会在站内展示；如主催已撤下作品，请联系主催。</p> : null}
    {message ? <Notice tone="success">{message}</Notice> : null}
    {error ? <Notice tone="error">{error}</Notice> : null}
  </section>;
}
