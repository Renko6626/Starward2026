import { formatDateTime, formatScheduledTime } from "../../app/lib/format";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Notice, PageHeading, ReadError, WorkspaceSection } from "../../app/components/ui";
import { applicationInterestFormatLabels } from "../../shared/applications";
import { ApiError, requestJson } from "../../app/lib/api";
import type { CollaborationResponse } from "../../shared/collaboration";
import { type PortalApplicationResponse, type PortalDashboardResponse } from "../../shared/portal";
import { RelayPublicationNotice } from "../components/RelayPublicationNotice";
import { NeighborSlots } from "../components/NeighborSlots";
import { RegistrationProgress } from "../components/RegistrationProgress";
import { RegistrationSection } from "../components/RegistrationSection";
import { SwapRequests } from "../components/SwapRequests";
import { authClient } from "../lib/auth-client";
import { PortalHistoryPage } from "./PortalHistoryPage";
import { PortalProfilePage } from "./PortalProfilePage";
import { PortalProjectPage } from "./PortalProjectPage";

type WorkspaceState = { dashboard: PortalDashboardResponse; application: PortalApplicationResponse; collaboration: CollaborationResponse };
export function PortalOverviewPage() {
  const navigate = useNavigate();
  const { segment } = getRouteApi("/portal/").useSearch();
  const session = authClient.useSession();
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [selection, setSelection] = useState<{ userId: string; segmentId: string } | null>(null);
  const userId = session.data?.user.id;
  const onSelectionChange = useCallback((segmentId: string) => {
    if (userId) setSelection(current => current?.userId === userId && current.segmentId === segmentId ? current : { userId, segmentId });
  }, [userId]);
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
  }, []);
  useEffect(() => {
    if (!session.isPending && !session.data) { void navigate({ to: "/portal/login", search: { segment } }); return; }
    if (!session.data) return;
    let cancelled = false;
    void refresh().catch(caught => {
      if (cancelled) return;
      if (caught instanceof ApiError && caught.status === 401) { void navigate({ to: "/portal/login", search: { segment } }); return; }
      setError(caught instanceof Error ? caught.message : "无法读取作者页面。");
    });
    return () => { cancelled = true; refreshSequence.current += 1; };
  }, [navigate, session.data, session.isPending, refresh, segment]);
  async function withdraw() {
    setWithdrawing(true); setError(null);
    try {
      const response = await requestJson<{ ok: true; message: string }>("/api/portal/application/withdraw", { method: "POST" });
      setMessage(response.message); setConfirmWithdraw(false);
      try { await refresh(); }
      catch { setError("报名已撤回，发布时间已释放。页面暂未更新，请点击“刷新状态”。"); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "撤回失败。"); }
    finally { setWithdrawing(false); }
  }
  if (!state || state.dashboard.user.id !== session.data?.user.id) return <div className="page-content creator-workspace"><PageHeading title="作者页面" />{error ? <ReadError message={error} /> : <p>正在读取报名和作品信息。</p>}</div>;
  const { dashboard, application, collaboration } = state;
  const approved = dashboard.participant?.status === "approved" || dashboard.participant?.status === "completed";
  const current = collaboration.segments.find(segment => segment.participantId === collaboration.participantId);
  const selected = collaboration.segments.find(item => item.id === (selection?.userId === userId ? selection?.segmentId : segment));
  const registration = application.application;
  const hasReviewResult = registration?.status === "approved" || registration?.status === "rejected";
  const hasFeedback = hasReviewResult || Boolean(registration?.adminNote) || collaboration.requests.length > 0;
  async function refreshStatus() {
    setRefreshing(true);
    try { await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "状态刷新失败，请稍后重试。"); }
    finally { setRefreshing(false); }
  }
  return <div className="page-content creator-workspace">
    <PageHeading title="作者页面"><Button variant="secondary" disabled={refreshing} aria-busy={refreshing} onClick={() => void refreshStatus()}>{refreshing ? "刷新中…" : "刷新状态"}</Button></PageHeading>
    {approved ? <RelayPublicationNotice key={dashboard.user.id} revision={revision} onSaved={refresh} /> : null}
    <RegistrationProgress application={application} participantStatus={dashboard.participant?.status} current={current} selected={selected}
      onWithdraw={() => setConfirmWithdraw(true)} withdrawing={withdrawing}
      withdrawalConfirmation={confirmWithdraw ? <Notice tone="warning"><p>撤回后将释放预留的发布时间。再次报名需重新选择时间并提交审核。确认撤回？</p><div className="workspace-actions"><Button variant="danger" disabled={withdrawing} onClick={() => void withdraw()}>{withdrawing ? "撤回中…" : "确认撤回"}</Button><Button variant="secondary" disabled={withdrawing} onClick={() => setConfirmWithdraw(false)}>保留报名</Button></div></Notice> : null}
    />
    {message ? <Notice tone="success">{message}</Notice> : null}{error ? <Notice tone="error">{error}</Notice> : null}
    {hasFeedback ? <section className="compact-feedback" id="tasks" aria-labelledby="portal-feedback-title">
      <h2 className="creator-card-title" id="portal-feedback-title">待办与反馈</h2>
      {registration && (hasReviewResult || registration.adminNote) ? <Notice tone={registration.status === "approved" ? "success" : "warning"}>
        <p>{registration.status === "approved" ? "报名审核通过" : registration.status === "rejected" ? "报名审核未通过" : "上次报名反馈"}{registration.reviewedAt ? `（${formatDateTime(registration.reviewedAt)}）` : ""}</p>
        {registration.adminNote ? <p className="registration-feedback-note">{registration.adminNote}</p> : null}
        {registration.status === "rejected" && application.editable ? <a className="text-link" href="#plan">修改报名资料</a> : null}
      </Notice> : null}
      {collaboration.requests.length ? <SwapRequests collaboration={collaboration} onSaved={refresh} /> : null}
    </section> : null}
    {approved ? <div className="creator-board">
      <PortalProfilePage embedded compact onSaved={refresh} />
      <section className="creator-card creator-work-card" id="project">
        <header className="creator-card-header"><h2 className="creator-card-title">作品资料</h2><Link className="text-link" to="/works" search={{ q: "", type: "all", view: "gallery" }}>调整或申请换期</Link></header>
        <div className="creator-card-body">
          <p>约定发布时间：{current ? `${current.code} ${formatScheduledTime(current.scheduledAt)}` : "尚未选择"}</p>
          <PortalProjectPage embedded compact onSaved={refresh} revision={revision} />
          <NeighborSlots revision={revision} />
          {application.application ? <div className="portal-registration-record"><WorkspaceSection id="plan" title="查看报名信息和创作意向">
            <p>参加形式：{applicationInterestFormatLabels[application.application.interestFormat]}</p>
            <p>{application.application.introText || "未填写创作意向。"}</p>
            {application.application.portfolioUrl ? <p>作品或主页：<a className="text-link" href={application.application.portfolioUrl} target="_blank" rel="noreferrer">{application.application.portfolioUrl}</a></p> : null}
            {application.application.messageToHosts ? <p>给主催的话：{application.application.messageToHosts}</p> : null}
          </WorkspaceSection></div> : <span id="plan" />}

        </div>
      </section>
    </div> : <><span id="project" /><RegistrationSection key={application.user.id} compact application={application} collaboration={collaboration} onSaved={refresh} onSelectionChange={onSelectionChange} /></>}
    <details id="history" className="portal-operation-history" open={historyOpen} onToggle={event => setHistoryOpen(event.currentTarget.open)}>
      <summary>查看操作记录</summary>
      {historyOpen ? dashboard.participant ? <PortalHistoryPage key={dashboard.user.id} embedded revision={revision} /> : <p className="workspace-empty">提交报名后，可在这里查看报名及后续操作记录。</p> : null}
    </details>
  </div>;
}
