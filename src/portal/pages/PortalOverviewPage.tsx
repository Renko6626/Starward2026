import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Notice, PageHeading, ReadError, StatusBadge, WorkspaceSection } from "../../app/components/ui";
import { ApiError, requestJson } from "../../app/lib/api";
import { applicationStatusLabels } from "../../shared/applications";
import type { CollaborationResponse } from "../../shared/collaboration";
import { projectDraftStatusLabels, type PortalApplicationResponse, type PortalDashboardResponse } from "../../shared/portal";
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
      catch { setError("报名已撤回并释放时段，但摘要暂未更新。请点击更新进度。"); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "撤回失败。"); }
    finally { setWithdrawing(false); }
  }
  if (!state) return <div className="page-content creator-workspace"><PageHeading eyebrow="CREATOR WORKSPACE" title="我的工作台" />{error ? <ReadError message={error} /> : <p>正在读取你的创作进度。</p>}</div>;
  const { dashboard, application, collaboration } = state;
  const approved = dashboard.participant?.status === "approved" || dashboard.participant?.status === "completed";
  const current = collaboration.segments.find(segment => segment.participantId === collaboration.participantId);
  const pendingRequests = collaboration.requests.filter(request => request.status === "pending");
  return <div className="page-content creator-workspace">
    <PageHeading title="我的工作台" description="查看报名进度、调整排期，整理作品资料。"><StatusBadge tone={approved ? "success" : application.application?.status === "pending" ? "warning" : "muted"}>{application.application ? applicationStatusLabels[application.application.status] : "报名未提交"}</StatusBadge><Button variant="secondary" onClick={() => void refresh().catch(caught => setError(caught instanceof Error ? caught.message : "进度更新失败，请稍后重试。"))}>更新进度</Button></PageHeading>
    <section className="workspace-summary" aria-label="我的计划与时段">
      <div><p className="eyebrow">我的创作计划</p><h2>{dashboard.profile?.creditName ?? "填写你的报名资料"}</h2><p>{application.application?.introText || "填写创作计划后，报名和时段预留会一起提交。"}</p></div>
      <div><p className="eyebrow">{current?.status === "reserved" ? "预留时段" : "当前时段"}</p><h2>{current ? `${current.code} ${current.name}` : "尚未选择"}</h2><p>{current?.status === "reserved" ? "审核中，时段已为你预留。" : current?.status === "confirmed" ? "报名已通过，时段已确认。" : approved ? "可以在排期区块认领空闲时段。" : "报名时选择一个可用时段。"}</p><div className="workspace-actions"><a className="text-link" href="#schedule">查看完整排期</a><a className="text-link" href={approved ? "#schedule" : "#plan"}>{approved ? "调整时间" : application.application ? "查看报名计划" : "填写报名"}</a></div></div>
    </section>
    {message ? <Notice tone="success">{message}</Notice> : null}{error ? <Notice tone="error">{error}</Notice> : null}
    <WorkspaceSection id="tasks" title="待办与反馈" summary={pendingRequests.length ? `${pendingRequests.length} 个换期请求待处理` : approved ? "继续整理作品资料" : "报名进度与审核意见"} defaultOpen={Boolean(application.application) || pendingRequests.length > 0}>
      {application.application?.adminNote ? <Notice tone="warning">主催意见：{application.application.adminNote}</Notice> : null}
      {approved ? <p>{dashboard.projectDraft ? `预告${projectDraftStatusLabels[dashboard.projectDraft.previewStatus]}，审查${projectDraftStatusLabels[dashboard.projectDraft.reviewStatus]}。` : "请补充作品预告和审查说明。"} <a className="text-link" href="#project">整理作品资料</a></p> : <p>{application.application?.status === "pending" ? "报名正在审核，审核结果会显示在这里。开放期间可以修改计划与预留时段。" : application.application ? "查看审核意见，在报名开放期间更新计划与时段。" : "先填写报名计划，提交后可在这里查看审核结果。"}</p>}
      <SwapRequests collaboration={collaboration} onSaved={refresh} />
    </WorkspaceSection>
    <WorkspaceSection id="plan" title="报名计划" summary={approved ? "已通过，报名资料锁定" : application.application ? "创作计划与预留时段" : "联系方式、创作计划与时段一起提交"} defaultOpen={!application.application}>
      <RegistrationSection application={application} collaboration={collaboration} onSaved={refresh} />
      {application.application?.status === "pending" ? <div className="space-y-4">{confirmWithdraw ? <Notice tone="warning"><p>撤回后会释放预留时段，并保留参与记录。确认撤回这次报名？</p><div className="workspace-actions"><Button variant="danger" disabled={withdrawing} onClick={() => void withdraw()}>{withdrawing ? "撤回中…" : "确认撤回并释放时段"}</Button><Button variant="secondary" disabled={withdrawing} onClick={() => setConfirmWithdraw(false)}>保留报名</Button></div></Notice> : <Button variant="secondary" onClick={() => setConfirmWithdraw(true)}>撤回报名</Button>}</div> : null}
    </WorkspaceSection>
    <WorkspaceSection id="schedule" title="日程安排" summary={current ? `${current.code} ${current.name}` : "尚未选择时段"}>
      {dashboard.participant?.status === "approved" ? <ScheduleSection collaboration={collaboration} onSaved={refresh} revision={revision} /> : <>
        <Notice>{dashboard.participant?.status === "completed" ? "参与已完成，可以查看排期。" : "可以查看所有时段；报名与预留时间在报名计划中一起提交。"}</Notice>
        <ScheduleGrid segments={collaboration.segments} participantId={collaboration.participantId}
          renderActions={dashboard.participant?.status === "completed" ? undefined : (_segment, close) => <a className="text-link" href="#plan" onClick={close}>前往报名计划选择时段</a>} />
      </>}
    </WorkspaceSection>
    <WorkspaceSection id="project" title="作品资料" summary={approved ? "公开预告与审查说明分别保存" : "报名通过后填写"} defaultOpen={approved}>
      {approved ? <PortalProjectPage embedded onSaved={refresh} revision={revision} /> : <Notice>报名审核通过后，可以在这里维护作品资料。</Notice>}
    </WorkspaceSection>
    <WorkspaceSection id="profile" title="署名与联系方式" summary={dashboard.profile?.contactEmail ?? dashboard.user.email}>
      {approved ? <PortalProfilePage embedded onSaved={refresh} /> : <Notice>署名和联系方式在报名计划中填写，与计划和时段一起保存。<a className="text-link" href="#plan">编辑报名资料</a></Notice>}
    </WorkspaceSection>
    <WorkspaceSection id="history" title="参与记录" summary="报名、排期和作品提交的进展">
      {dashboard.participant ? <PortalHistoryPage embedded revision={revision} /> : <p className="workspace-empty">提交报名后，参与记录会显示在这里。</p>}
    </WorkspaceSection>
  </div>;
}
