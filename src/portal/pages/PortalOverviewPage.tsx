import { useSiteTranslation } from "../../i18n/use-site-translation";
import { ArchiveChapter } from "../components/ArchiveChapter";
import { ArrowUpRight } from "lucide-react";
import "../archive.css";
import { PortalAccount } from "../../app/layouts/WorkspaceLayout";
import { formatDateTime, formatScheduledTime } from "../../app/lib/format";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Notice, PageHeading, ReadError } from "../../app/components/ui";
import { ActivityIdentity } from "../../app/components/ActivityIdentity";
import { MissionCountdown } from "../../app/components/MissionCountdown";
import { ApiError, requestJson } from "../../app/lib/api";
import type { CollaborationResponse } from "../../shared/collaboration";
import { type PortalApplicationResponse, type PortalDashboardResponse } from "../../shared/portal";
import { ScheduleSection } from "../components/ScheduleSection";
import { NeighborSlots } from "../components/NeighborSlots";
import { RegistrationProgress } from "../components/RegistrationProgress";
import { RegistrationSection } from "../components/RegistrationSection";
import { SwapRequests } from "../components/SwapRequests";
import { authClient } from "../lib/auth-client";
import { PortalHistoryPage } from "./PortalHistoryPage";

type WorkspaceState = { dashboard: PortalDashboardResponse; application: PortalApplicationResponse; collaboration: CollaborationResponse };
export function PortalOverviewPage() {
  const { t, language, label: systemLabel } = useSiteTranslation();
  const navigate = useNavigate();
  const { segment } = getRouteApi("/portal/").useSearch();
  const session = authClient.useSession();
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [registrationSubmitted, setRegistrationSubmitted] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  useEffect(() => {
    const reveal = () => {
      if (window.location.hash === "#history") setHistoryOpen(true);
    };
    const revealClicked = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (anchor?.getAttribute("href") === "#history") setHistoryOpen(true);
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    document.addEventListener("click", revealClicked);
    return () => {
      window.removeEventListener("hashchange", reveal);
      document.removeEventListener("click", revealClicked);
    };
  }, []);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const refreshSequence = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    const [dashboard, application, collaboration] = await Promise.all([
      requestJson<PortalDashboardResponse>("/api/portal/dashboard"),
      requestJson<PortalApplicationResponse>("/api/portal/application"),
      requestJson<CollaborationResponse>("/api/portal/collaboration"),
    ]);
    if (sequence !== refreshSequence.current) return;
    setState({ dashboard, application, collaboration });
    setRevision(value => value + 1);
    setError(null);
  }, [language]);
  useEffect(() => {
    if (!session.isPending && !session.data) { void navigate({ to: "/portal/login", search: { segment } }); return; }
    if (!session.data) return;
    let cancelled = false;
    void refresh().catch(caught => {
      if (cancelled) return;
      if (caught instanceof ApiError && caught.status === 401) { void navigate({ to: "/portal/login", search: { segment } }); return; }
      setError(caught instanceof Error ? caught.message : t("portal.workspace.loadError"));
    });
    return () => { cancelled = true; refreshSequence.current += 1; };
  }, [navigate, session.data, session.isPending, refresh, segment]);
  async function withdraw() {
    setWithdrawing(true); setError(null);
    try {
      const response = await requestJson<{ ok: true; message: string }>("/api/portal/application/withdraw", { method: "POST" });
      setMessage(response.message); setConfirmWithdraw(false);
      try { await refresh(); }
      catch { setError(t("portal.registration.withdrawRefresh")); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : t("portal.registration.withdrawError")); }
    finally { setWithdrawing(false); }
  }
  if (!state || state.dashboard.user.id !== session.data?.user.id) return <div className="page-content creator-workspace author-archive"><PageHeading title={t("portal.workspace.title")} meta={<ActivityIdentity />}>{session.data ? <PortalAccount /> : null}</PageHeading>{error ? <ReadError message={systemLabel(error)} /> : <p>{t("portal.workspace.loading")}</p>}</div>;
  const { dashboard, application, collaboration } = state;
  const approved = dashboard.participant?.status === "approved" || dashboard.participant?.status === "completed";
  const current = collaboration.segments.find(segment => segment.participantId === collaboration.participantId);
  const registration = application.application;
  const firstRegistration = !registration && !approved && application.editable;
  async function registrationSaved() {
    await refresh();
    if (firstRegistration) setRegistrationSubmitted(true);
  }
  const hasReviewResult = registration?.status === "rejected";
  const hasFeedback = hasReviewResult || Boolean(registration?.adminNote) || collaboration.requests.some(request => request.status === "pending");
  async function refreshStatus() {
    setRefreshing(true);
    try { await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : t("portal.workspace.refreshError")); }
    finally { setRefreshing(false); }
  }
  return <div className="page-content creator-workspace author-archive">
    {dashboard.participant?.status === "approved" ? <MissionCountdown target="submission" /> : null}
    <PageHeading title={firstRegistration ? t("portal.registration.start") : t("portal.workspace.archive")} meta={<ActivityIdentity />}><PortalAccount />{!firstRegistration ? <div className="archive-control"><span className="archive-control-label" aria-hidden="true">STATUS / SYNC</span><Button appearance="industrial" variant="secondary" disabled={refreshing} aria-busy={refreshing} onClick={() => void refreshStatus()}>{refreshing ? t("portal.workspace.refreshing") : t("portal.workspace.refresh")}</Button></div> : null}</PageHeading>
    {firstRegistration ? <section className="registration-onboarding" aria-label={t("portal.registration.instructions")}>
      <p>{t("portal.registration.introduction")}</p>
      <ol aria-label={t("portal.registration.steps")}><li>{t("portal.profile.basic")}</li><li>{t("portal.registration.intent")}</li><li>{t("portal.registration.submit")}</li></ol>
    </section> : <RegistrationProgress application={application} participantStatus={dashboard.participant?.status} current={current} focusAfterSubmit={registrationSubmitted}
      onWithdraw={() => setConfirmWithdraw(true)} withdrawing={withdrawing}
      withdrawalConfirmation={confirmWithdraw ? <Notice tone="warning"><p>{t("portal.registration.withdrawConfirm")}</p><div className="workspace-actions"><Button appearance="industrial" variant="danger" disabled={withdrawing} onClick={() => void withdraw()}>{withdrawing ? t("portal.registration.withdrawing") : t("portal.registration.withdrawAction")}</Button><Button appearance="industrial" variant="secondary" disabled={withdrawing} onClick={() => setConfirmWithdraw(false)}>{t("portal.registration.keep")}</Button></div></Notice> : null}
    />}
    {!firstRegistration ? <nav className="archive-index" aria-label={t("portal.workspace.contentsLabel")}><span>{t("portal.workspace.contents")}</span><a href="#profile"><span>01</span>{t("portal.profile.basic")}</a><a href="#plan"><span>02</span>{t("portal.registration.intent")}</a>{approved ? <a href="#relay"><span>03</span>{t("portal.schedule.relay")}</a> : null}</nav> : null}
    {message ? <Notice tone="success">{systemLabel(message)}</Notice> : null}{error ? <Notice tone="error">{systemLabel(error)}</Notice> : null}
    {hasFeedback ? <section className="compact-feedback" id="tasks" aria-labelledby="portal-feedback-title">
      <h2 className="creator-card-title" id="portal-feedback-title">{t("portal.workspace.feedback")}</h2>
      {registration && (hasReviewResult || registration.adminNote) ? <Notice tone={registration.status === "approved" ? "success" : "warning"}>
        <p>{registration.status === "approved" ? t("portal.registration.approvedReview") : registration.status === "rejected" ? t("portal.registration.rejectedReview") : t("portal.registration.previousFeedback")}{registration.reviewedAt ? `（${formatDateTime(registration.reviewedAt, language)}）` : ""}</p>
        {registration.adminNote ? <p className="registration-feedback-note">{registration.adminNote}</p> : null}
        {registration.status === "rejected" && application.editable ? <a className="text-link" href="#plan">{t("portal.registration.edit")}</a> : null}
      </Notice> : null}
      {collaboration.requests.length ? <SwapRequests collaboration={collaboration} onSaved={refresh} /> : null}
    </section> : null}
    <RegistrationSection key={application.user.id} compact application={application} collaboration={collaboration} onSaved={registrationSaved} />
    {/* 作品预告与审查说明暂时关闭，编辑器保留在 PortalProjectPage 中供后续恢复。 */}
    {approved ? <ArchiveChapter id="relay" number="03" title={t("portal.schedule.relay")} defaultOpen state={current ? `${current.code} / ${current.status === "confirmed" ? t("portal.schedule.confirmed") : t("portal.schedule.reserved")}` : t("portal.schedule.hostArranged")}>
      <p>{t("portal.schedule.agreedTime")}{current ? `${current.code} ${formatScheduledTime(current.scheduledAt, language)}` : t("portal.schedule.hostArranged")}</p>
      {current ? <ScheduleSection collaboration={collaboration} selectedSegmentId={current.id} revision={revision} onSaved={refresh} /> : null}
      <NeighborSlots revision={revision} collaboration={collaboration} onSaved={refresh} />
      <Link className="button button--primary button--industrial button--accent relay-schedule-action" to="/works" search={{ q: "", type: "all", view: "gallery" }}>{t("portal.schedule.adjust")}<ArrowUpRight size={18} aria-hidden="true" /></Link>
    </ArchiveChapter> : null}
    {!firstRegistration ? <details id="history" className="portal-operation-history" open={historyOpen} onToggle={event => setHistoryOpen(event.currentTarget.open)}>
      <summary>{t("portal.history.view")}</summary>
      {historyOpen ? dashboard.participant ? <PortalHistoryPage key={dashboard.user.id} embedded revision={revision} /> : <p className="workspace-empty">{t("portal.history.afterRegistration")}</p> : null}
    </details> : null}
  </div>;
}
