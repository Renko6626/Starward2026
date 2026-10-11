import { useSiteTranslation } from "../../i18n/use-site-translation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Button, Field, Notice } from "../../app/components/ui";
import { requestJson } from "../../app/lib/api";
import { formatScheduledTime } from "../../app/lib/format";
import type { PortalProjectMutationResponse, PortalProjectResponse } from "../../shared/portal";
import { getRelayPublicationState } from "../../shared/relay-publication";

export function RelayPublicationNotice({ revision, onSaved }: { revision: number; onSaved: () => Promise<void> }) {
  const { t, language, label: systemLabel } = useSiteTranslation();
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
        if (!cancelled && request === sequence.current) setError(caught instanceof Error ? caught.message : t("portal.release.loadError"));
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    return () => { cancelled = true; sequence.current += 1; window.clearInterval(timer); };
  }, [revision, language]);

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
      await onSaved().catch(() => setError(t("portal.release.savedRefresh")));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("portal.release.confirmError"));
    } finally { setBusy(false); }
  }

  if (!project) return error ? <Notice tone="warning">{systemLabel(error)}</Notice> : null;
  const { release, draft } = project;
  const title = release.phase === "confirmed" ? t("portal.release.confirmedTitle")
    : release.phase === "today" ? t("portal.release.todayTitle")
    : release.phase === "overdue" ? t("portal.release.overdueTitle")
    : release.phase === "unconfigured" ? t("portal.release.unassignedTitle")
    : t("portal.release.daysRemaining", { days: release.remainingDays, count: release.remainingDays });
  if (release.phase === "upcoming" && !release.showReminder) return error ? <Notice tone="warning">{systemLabel(error)}</Notice> : null;
  return <section className={`relay-publication-notice${release.showReminder ? " is-due" : ""}`} aria-labelledby="relay-publication-title">
    <div className="relay-publication-heading"><h2 id="relay-publication-title">{title}</h2>
      {release.scheduledAt ? <p>{t("portal.schedule.agreedTime")}{formatScheduledTime(release.scheduledAt, language)}{t("portal.schedule.beijingSuffix")}</p> : null}
    </div>
    {release.phase === "confirmed" ? <p>{t("portal.release.confirmationTime")}{formatScheduledTime(release.confirmedAt, language)}{t("portal.release.editKeepsConfirmation")}</p>
      : release.phase === "today" ? <p>{t("portal.release.todayInstructions")}</p>
      : release.phase === "overdue" ? <p>{t("portal.release.overdueInstructions")}</p>
      : release.phase === "unconfigured" ? <p>{t("portal.release.unassignedInstructions")}</p>
      : <p>{t("portal.release.upcomingInstructions")}</p>}
    {release.canEditLink ? <form className="relay-publication-form" onSubmit={event => void save(event)}>
      <Field label={t("portal.release.url")}>
        <input className="field-input" type="url" required maxLength={2048} value={workUrl} disabled={busy}
          placeholder={t("portal.release.urlPlaceholder")} onChange={event => { dirty.current = true; setWorkUrl(event.target.value); }} />
      </Field>
      <div className="archive-control"><span className="archive-control-label" aria-hidden="true">RELEASE / {release.confirmedAt ? "SAVE" : "CONFIRM"}</span><Button appearance={release.confirmedAt ? "industrial" : "framed"} className={release.confirmedAt ? undefined : "button--accent"} type="submit" disabled={busy || !workUrl.trim()} aria-busy={busy}>{busy ? t("portal.common.submitting") : release.confirmedAt ? t("portal.release.saveUrl") : t("portal.release.confirm")}</Button></div>
    </form> : null}
    {release.confirmedAt ? draft.publishedAt
      ? <Link className="text-link" to="/works/$workId" params={{ workId: draft.id }}>{t("portal.project.viewPublic")}</Link>
      : <p className="field-hint">{t("portal.release.siteDisplayHint")}</p> : null}
    {message ? <Notice tone="success">{systemLabel(message)}</Notice> : null}
    {error ? <Notice tone="error">{systemLabel(error)}</Notice> : null}
  </section>;
}
