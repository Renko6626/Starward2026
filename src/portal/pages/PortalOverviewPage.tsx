import { formatScheduledTime } from "../../app/lib/format";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Notice, PageHeading, ReadError, StatusBadge, WorkspaceSection } from "../../app/components/ui";
import { ApiError, requestJson } from "../../app/lib/api";
import { applicationStatusLabels } from "../../shared/applications";
import type { CollaborationResponse } from "../../shared/collaboration";
import { type PortalApplicationResponse, type PortalDashboardResponse } from "../../shared/portal";
import { NeighborSlots } from "../components/NeighborSlots";
import { RegistrationSection } from "../components/RegistrationSection";
import { ScheduleSection } from "../components/ScheduleSection";
import { ScheduleGrid } from "../components/ScheduleGrid";
import { SwapRequests } from "../components/SwapRequests";
import { authClient } from "../lib/auth-client";
import { PortalHistoryPage } from "./PortalHistoryPage";
import { PortalProfilePage } from "./PortalProfilePage";
import { PortalProjectPage } from "./PortalProjectPage";

type WorkspaceState = { dashboard: PortalDashboardResponse; application: PortalApplicationResponse; collaboration: CollaborationResponse };
export function PortalOverviewPage() {
  const navigate = useNavigate();
  const session = authClient.useSession();
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
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
    if (!session.isPending && !session.data) { void navigate({ to: "/portal/login" }); return; }
    if (!session.data) return;
    let cancelled = false;
    void refresh().catch(caught => {
      if (cancelled) return;
      if (caught instanceof ApiError && caught.status === 401) { void navigate({ to: "/portal/login" }); return; }
      setError(caught instanceof Error ? caught.message : "无法读取工作台。");
    });
    return () => { cancelled = true; refreshSequence.current += 1; };
  }, [navigate, session.data, session.isPending, refresh]);
  async function withdraw() {
    setWithdrawing(true); setError(null);
    try {
      const response = await requestJson<{ ok: true; message: string }>("/api/portal/application/withdraw", { method: "POST" });
      setMessage(response.message); setConfirmWithdraw(false);
      try { await refresh(); }
      catch { setError("报名已撤回并释放发布时点，但摘要暂未更新。请点击更新进度。"); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "撤回失败。"); }
    finally { setWithdrawing(false); }
  }
  if (!state) return <div className="page-content creator-workspace"><PageHeading eyebrow="CREATOR WORKSPACE" title="我的工作台" />{error ? <ReadError message={error} /> : <p>正在读取你的创作进度。</p>}</div>;
  const { dashboard, application, collaboration } = state;
  const approved = dashboard.participant?.status === "approved" || dashboard.participant?.status === "completed";
  const current = collaboration.segments.find(segment => segment.participantId === collaboration.participantId);
  const pendingRequests = collaboration.requests.filter(request => request.status === "pending");
  return <div className="page-content creator-workspace">
    <PageHeading title="我的工作台"><StatusBadge tone={approved ? "success" : application.application?.status === "pending" ? "warning" : "muted"}>{application.application ? applicationStatusLabels[application.application.status] : "报名未提交"}</StatusBadge><Button variant="secondary" onClick={() => void refresh().catch(caught => setError(caught instanceof Error ? caught.message : "进度更新失败，请稍后重试。"))}>更新进度</Button></PageHeading>
    {message ? <Notice tone="success">{message}</Notice> : null}{error ? <Notice tone="error">{error}</Notice> : null}
    {application.application?.adminNote || pendingRequests.length ? <div className="compact-feedback">
      {application.application?.adminNote ? <Notice tone="warning">主催意见：{application.application.adminNote}</Notice> : null}
      {pendingRequests.length ? <SwapRequests collaboration={{ ...collaboration, requests: pendingRequests }} onSaved={refresh} /> : null}
    </div> : null}
    {approved ? <div className="creator-board">
      <PortalProfilePage embedded compact onSaved={refresh} />
      <section className="creator-card creator-work-card" id="project">
        <header className="creator-card-header"><h2 className="creator-card-title">当前作品</h2><a className="text-link" href="#schedule">调整发布时点</a></header>
        <div className="creator-card-body">
          <div className="workspace-actions"><p>当前发布时点：{current ? `${current.code} ${formatScheduledTime(current.scheduledAt)}` : "尚未选择"}</p><a className="text-link" href="#schedule">调整</a></div>
          <PortalProjectPage embedded compact onSaved={refresh} revision={revision} />
          <NeighborSlots revision={revision} />
        </div>
      </section>
    </div> : <><span id="project" /><RegistrationSection compact application={application} collaboration={collaboration} onSaved={refresh} /></>}
    <WorkspaceSection id={approved ? "plan" : "registration-status"} title="报名记录" summary={approved ? "已通过，报名计划锁定" : application.application?.status === "pending" ? "审核中，发布时点已预留" : "报名与发布时点一起提交"}>
      {approved ? <RegistrationSection application={application} collaboration={collaboration} onSaved={refresh} /> : <p>{application.application?.introText || "填写右侧创作计划并选择发布时点后，即可提交报名。"}</p>}
      {application.application?.status === "pending" ? <div className="space-y-4">{confirmWithdraw ? <Notice tone="warning"><p>撤回后会释放预留发布时点，并保留参与记录。确认撤回这次报名？</p><div className="workspace-actions"><Button variant="danger" disabled={withdrawing} onClick={() => void withdraw()}>{withdrawing ? "撤回中…" : "确认撤回并释放发布时点"}</Button><Button variant="secondary" disabled={withdrawing} onClick={() => setConfirmWithdraw(false)}>保留报名</Button></div></Notice> : <Button variant="secondary" onClick={() => setConfirmWithdraw(true)}>撤回报名</Button>}</div> : null}
    </WorkspaceSection>
    <WorkspaceSection id="schedule" title="完整排期" summary={current ? `${current.code} ${formatScheduledTime(current.scheduledAt)}` : "尚未选择发布时点"}>
      {dashboard.participant?.status === "approved" ? <ScheduleSection collaboration={collaboration} onSaved={refresh} revision={revision} /> : <ScheduleGrid segments={collaboration.segments} participantId={collaboration.participantId} renderActions={dashboard.participant?.status === "completed" ? undefined : (_segment, close) => <a className="text-link" href="#plan" onClick={close}>前往创作计划选择发布时点</a>} />}
    </WorkspaceSection>
    <WorkspaceSection id="history" title="参与记录">
      {dashboard.participant ? <PortalHistoryPage embedded revision={revision} /> : <p className="workspace-empty">提交报名后，参与记录会显示在这里。</p>}
    </WorkspaceSection>
  </div>;
}
