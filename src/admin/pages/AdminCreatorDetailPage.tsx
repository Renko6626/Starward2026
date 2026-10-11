import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Button, DetailBlock, DetailItem, Field, Notice, PageHeading, ReadError, StatusBadge } from "../../app/components/ui";
import { requestJson } from "../../app/lib/api";
import { formatDateTime, formatScheduledTime } from "../../app/lib/format";
import { adminParticipantStatusLabels, adminProjectDraftStatusLabels, type AdminParticipantDetail, type AdminParticipantDetailResponse, type AdminProjectDraftItem, type AdminProjectDraftListResponse, type AdminSegmentItem, type AdminSegmentListResponse, type AdminSegmentMutationResponse, type UpdateParticipantInput } from "../../shared/admin";
import { applicationInterestFormatLabels, applicationStatusLabels, type AdminApplicationDetailResponse, type ApplicationDetail, type UpdateApplicationReviewInput } from "../../shared/applications";
import { getReviewNoteTemplates } from "../lib/review-note";
import { listAvailableApplicationReviewStatuses } from "../lib/application-review";

type Detail = { participant: AdminParticipantDetail | null; application: ApplicationDetail | null; segment: AdminSegmentItem | null; draft: AdminProjectDraftItem | null };
type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; detail: Detail };
const actionLabels = { approved: "批准报名", rejected: "拒绝报名", withdrawn: "标记撤回" } as const;

export function AdminCreatorDetailPage({ participantId, applicationId }: { participantId?: string; applicationId?: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [adminNote, setAdminNote] = useState("");
  const [form, setForm] = useState<UpdateParticipantInput>({ status: "pending", contactHandle: "" });
  const [seats, setSeats] = useState<AdminSegmentItem[]>([]);
  const [assignment, setAssignment] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const readDetail = useCallback(async (): Promise<Detail> => {
    let participant: AdminParticipantDetail | null = null;
    let application: ApplicationDetail | null = null;
    if (participantId) {
      participant = (await requestJson<AdminParticipantDetailResponse>(`/api/admin/participants/${participantId}`)).participant;
      if (participant.applicationId) application = (await requestJson<AdminApplicationDetailResponse>(`/api/admin/applications/${participant.applicationId}`)).application;
    } else if (applicationId) {
      application = (await requestJson<AdminApplicationDetailResponse>(`/api/admin/applications/${applicationId}`)).application;
      if (application.participant) participant = (await requestJson<AdminParticipantDetailResponse>(`/api/admin/participants/${application.participant.id}`)).participant;
    }
    if (!participant && !application) throw new Error("未找到参与者记录。");
    if (!participant) return { participant, application, segment: null, draft: null };
    const [segments, drafts] = await Promise.all([
      requestJson<AdminSegmentListResponse>("/api/admin/segments"),
      requestJson<AdminProjectDraftListResponse>("/api/admin/project-drafts"),
    ]);
    setSeats(segments.items);
    return { participant, application, segment: segments.items.find(item => item.currentParticipantId === participant.id) ?? null, draft: drafts.items.find(item => item.participantId === participant.id) ?? null };
  }, [participantId, applicationId]);
  function applyDetail(detail: Detail) {
    setState({ status: "ready", detail });
    setAdminNote(detail.application?.adminNote ?? "");
    if (detail.participant) setForm({ status: detail.participant.status, contactHandle: detail.participant.contactHandle ?? "" });
  }
  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" }); setNotice(null);
    void readDetail().then(detail => { if (!cancelled) applyDetail(detail); }).catch((error: Error) => {
      if (!cancelled) setState({ status: "error", message: error.message || "无法读取参与者详情。" });
    });
    return () => { cancelled = true; };
  }, [readDetail]);
  async function mutate(action: () => Promise<string>) {
    setBusy(true); setNotice(null);
    try {
      const message = await action();
      try { applyDetail(await readDetail()); setNotice({ tone: "success", message }); }
      catch { setNotice({ tone: "error", message: `${message} 页面更新失败，请刷新查看最新状态。` }); }
    } catch (error) { setNotice({ tone: "error", message: error instanceof Error ? error.message : "操作失败，请稍后重试。" }); }
    finally { setBusy(false); }
  }
  if (state.status !== "ready") return <div className="page-content"><PageHeading title="参与者详情" />{state.status === "error" ? <ReadError message={state.message} /> : <p>正在读取参与者资料。</p>}</div>;
  const { participant, application, segment, draft } = state.detail;
  const profile = application?.portalProfile;
  const name = participant?.displayName ?? application?.displayName ?? "未填写署名";
  async function review(status: UpdateApplicationReviewInput["status"]) {
    if (!application) return;
    await mutate(async () => {
      const response = await requestJson<AdminApplicationDetailResponse>(`/api/admin/applications/${application.id}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, adminNote: adminNote.trim() || undefined } satisfies UpdateApplicationReviewInput),
      });
      // The review may be saved even when its automatic email fails.
      return `已更新为${applicationStatusLabels[response.application.status]}。`;
    });
  }
  return <div className="page-content">
    <Link className="text-link" to="/admin/participants" search={{ view: "pending" }}>返回参与者管理</Link>
    <PageHeading title={name} description="参与者详情">
      <StatusBadge>{application ? applicationStatusLabels[application.status] : "未提交报名"}</StatusBadge>
    </PageHeading>
    {notice ? <Notice tone={notice.tone}>{notice.message}</Notice> : null}
    <div className="admin-detail-grid">
      <div className="space-y-5">
        <section className="panel space-y-4"><h2 className="text-lg font-medium">署名与联系</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DetailItem label="署名" value={name} />
            <DetailItem label="对外署名" value={(profile?.isAnonymous ?? participant?.isAnonymous) ? "匿名" : profile?.creditName ?? name} />
            <DetailItem label="联系邮箱" value={profile?.contactEmail ?? participant?.inviteEmail ?? application?.contactEmail ?? "未填写"} />
            <DetailItem label="联系方式" value={profile ? `${profile.primaryContactChannel}: ${profile.primaryContactHandle}` : participant?.contactHandle ?? application?.contactHandle ?? "未填写"} />
            {profile?.backupContact ? <DetailItem label="备用联系" value={profile.backupContact} /> : null}
          </div>
        </section>
        <section className="panel space-y-4"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-medium">当前发布时点</h2><Link className="text-link" to="/admin/schedule">管理排期</Link></div>
          <p className="text-lg">{segment ? `${segment.code} ${segment.name}` : "待主催安排"}</p>
          {segment ? <p>{formatScheduledTime(segment.scheduledAt)}<span className="ml-3 text-on-surface-variant">{application?.status === "pending" ? "待审核预留" : participant && ["approved", "completed"].includes(participant.status) ? "已确认" : "请核对参与资格"}</span></p> : null}
          {participant?.status === "approved" ? <div className="space-y-3">
            <Field label="分配席位"><select className="field-input" value={assignment} onChange={event => setAssignment(event.target.value)} disabled={busy}><option value="">请选择席位</option>{seats.filter(item => (!item.currentParticipantId && ["open","released"].includes(item.status)) || item.currentParticipantId === participant.id).map(item => <option key={item.id} value={item.id}>{item.kind === "special" ? "特别席位 · " : ""}{item.code} {item.name} · {formatScheduledTime(item.scheduledAt)}</option>)}</select></Field>
            <Button disabled={busy || !assignment} onClick={() => void mutate(async () => {
              const selected = seats.find(item => item.id === assignment)!;
              const response = await requestJson<AdminSegmentMutationResponse>(`/api/admin/segments/${selected.id}`, {method: "PATCH", headers: {"content-type":"application/json"}, body: JSON.stringify({status: "held", currentParticipantId: participant.id})});
              setAssignment(""); return response.message;
            })}>分配发布时间</Button>
          </div> : null}
        </section>
        <section className="panel space-y-4"><h2 className="text-lg font-medium">报名计划</h2>
          {application ? <>
            <div className="admin-work-summary"><span>{applicationInterestFormatLabels[application.interestFormat]}</span><span>提交于 {formatDateTime(application.createdAt)}</span></div>
            <DetailBlock title="创作意向" value={application.introText || "未填写"} />
            {application.portfolioUrl ? <p>作品或主页：<a className="text-link break-all" href={application.portfolioUrl} target="_blank" rel="noreferrer">{application.portfolioUrl}</a></p> : null}
            {application.messageToHosts ? <DetailBlock title="给主催的话" value={application.messageToHosts} /> : null}
          </> : <p className="text-on-surface-variant">该账号尚未提交报名。</p>}
        </section>
        {draft ? <section className="panel space-y-4"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-medium">作品资料</h2><Link className="text-link" to="/admin/project-drafts/$draftId" params={{ draftId: draft.id }}>查看作品审核</Link></div><p>{draft.previewTitle ?? "尚未填写标题"}</p><p className="text-on-surface-variant">预告：{adminProjectDraftStatusLabels[draft.previewStatus]}；正式审查：{adminProjectDraftStatusLabels[draft.reviewStatus]}</p></section> : null}
        <details className="panel admin-disclosure"><summary>账号与审核记录</summary><div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          <DetailItem label="报名 ID" value={application?.id ?? "未提交"} />
          <DetailItem label="参与者 ID" value={participant?.id ?? "未关联"} />
          <DetailItem label="登录邮箱" value={application?.authUser ? application.authUser.email ?? "未设置登录邮箱" : participant?.inviteEmail ?? "未绑定账号"} />
          <DetailItem label="用户 ID" value={participant?.userId ?? application?.authUser?.id ?? "未绑定"} />
          <DetailItem label="联系资料" value={profile ? "已填写" : "未读取到报名联系资料"} />
          <DetailItem label="审核时间" value={formatDateTime(application?.reviewedAt ?? null)} />
          <DetailItem label="审核人" value={application?.reviewedBy ?? "未记录"} />
          {participant ? <><DetailItem label="门户激活时间" value={formatDateTime(participant.activatedAt)} /><DetailItem label="最近更新时间" value={formatDateTime(participant.updatedAt)} /></> : null}
        </div></details>
      </div>
      <div className="space-y-5">
        {application ? <section className="panel space-y-4"><h2 className="text-lg font-medium">报名审核</h2>
          <Field label="审核意见（创作者可见）"><textarea className="field-input" rows={4} maxLength={2000} disabled={busy} value={adminNote} onChange={event => setAdminNote(event.target.value)} /></Field>
          <details className="admin-disclosure"><summary>常用意见</summary><div className="flex flex-wrap gap-2 pt-3">{getReviewNoteTemplates().map(template => <Button key={template.id} variant="secondary" disabled={busy} onClick={() => setAdminNote(template.body)}>{template.label}</Button>)}</div></details>
          <div className="space-y-2">{listAvailableApplicationReviewStatuses(application.status).map(status => <Button key={status} className="w-full" variant={status === "approved" ? "primary" : status === "rejected" ? "danger" : "secondary"} disabled={busy} onClick={() => void review(status)}>{actionLabels[status]}</Button>)}</div>
          <p className="text-sm text-on-surface-variant">审核意见随上方审核动作保存。拒绝或撤回会释放预留时点，批准后可在作者页面查看结果。</p>
        </section> : null}
        {participant ? <section className="panel space-y-4"><h2 className="text-lg font-medium">参与资格</h2><p>{adminParticipantStatusLabels[participant.status]}</p>

          <details className="admin-disclosure"><summary>修改资格与联系备注</summary><div className="space-y-4 pt-4">
            <Field label="联系方式备注"><input className="field-input" disabled={busy} value={form.contactHandle ?? ""} maxLength={120} onChange={event => setForm(current => ({ ...current, contactHandle: event.target.value }))} /></Field>
            <Field label="参与资格"><select className="field-input" disabled={busy} value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value as UpdateParticipantInput["status"] }))}>{Object.entries(adminParticipantStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Button disabled={busy} onClick={() => void mutate(async () => {
              const response = await requestJson<AdminParticipantDetailResponse>(`/api/admin/participants/${participant.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, contactHandle: form.contactHandle?.trim() || undefined }) });
              return `已保存参与资格：${adminParticipantStatusLabels[response.participant.status]}。`;
            })}>保存参与者设置</Button>
          </div></details>
        </section> : null}
      </div>
    </div>
  </div>;
}
