import { formatScheduledTime } from "../../app/lib/format";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Field, Notice } from "../../app/components/ui";
import { requestJson } from "../../app/lib/api";
import { getTurnstileSiteKey, normalizeApplicationInput } from "../../app/lib/apply-form";
import { loadTurnstileApi } from "../../app/lib/turnstile";
import { applicationInterestFormatLabels, type ApplicationIntakeResponse } from "../../shared/applications";
import { workspaceApplicationInputSchema, type CollaborationResponse, type WorkspaceApplicationInput, type WorkspaceApplicationResponse } from "../../shared/collaboration";
import { updatePortalProfileInputSchema, type PortalProfileMutationResponse, type PortalApplicationResponse } from "../../shared/portal";
import { getApplicationWindowLabel } from "../../shared/windows";
import { normalizePortalProfileInput } from "../lib/profile-form";
import { PasswordSettings } from "./PasswordSettings";
import { ScheduleGrid } from "./ScheduleGrid";

export function RegistrationSection({ application, collaboration, onSaved, compact = false }: {
  compact?: boolean;
  application: PortalApplicationResponse;
  collaboration: CollaborationResponse;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<WorkspaceApplicationInput>(() => ({
    profile: {
      creditName: application.profile?.creditName ?? "",
      bilibiliUid: application.profile?.bilibiliUid ?? "",
      contactEmail: application.profile?.contactEmail ?? application.user.email,
      primaryContactChannel: application.profile?.primaryContactChannel ?? "Email",
      primaryContactHandle: application.profile?.primaryContactHandle ?? application.user.email,
      backupContact: application.profile?.backupContact ?? "",
      isAnonymous: application.profile?.isAnonymous ?? true,
    },
    application: {
      contactEmail: application.application?.contactEmail ?? application.profile?.contactEmail ?? application.user.email,
      contactHandle: application.application?.contactHandle ?? "",
      interestFormat: application.application?.interestFormat ?? "novel",
      introText: application.application?.introText ?? "",
      portfolioUrl: application.application?.portfolioUrl ?? "",
      messageToHosts: application.application?.messageToHosts ?? "",
    },
    segmentId: collaboration.segments.find(item => item.participantId === collaboration.participantId)?.id ?? "",
  }));
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [intake, setIntake] = useState<ApplicationIntakeResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | undefined>(undefined);
  const siteKey = getTurnstileSiteKey(import.meta.env);
  const required = Boolean(intake?.turnstileEnabled);
  const editable = application.editable;
  const disabled = !editable || saving || savingProfile;
  useEffect(() => {
    let cancelled = false;
    void requestJson<ApplicationIntakeResponse>("/api/applications/intake").then(value => {
      if (!cancelled) { setIntake(value); setError(null); }
    }).catch(caught => { if (!cancelled) setError(caught instanceof Error ? caught.message : "无法读取报名验证设置，请稍后重试。"); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!required || !siteKey || !editable || !containerRef.current) return;
    let cancelled = false;
    void loadTurnstileApi().then(api => {
      if (cancelled || !containerRef.current) return;
      widgetRef.current = api.render(containerRef.current, {
        sitekey: siteKey,
        callback: value => setToken(value),
        "expired-callback": () => setToken(null),
        "error-callback": () => setToken(null),
      });
    }).catch(() => setError("人机验证加载失败，请刷新后重试。"));
    return () => { cancelled = true; if (widgetRef.current) window.turnstile?.remove?.(widgetRef.current); widgetRef.current = undefined; };
  }, [required, siteKey, editable]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null); setMessage(null); setRefreshWarning(null);
    if (!editable || !intake) { setError("报名设置尚未就绪或当前不能修改报名。"); return; }
    if (required && (!siteKey || !token)) { setError("请先完成人机验证后再提交。"); return; }
    const normalized = normalizeApplicationInput({ ...form.application, contactEmail: form.profile.contactEmail, contactHandle: `${form.profile.primaryContactChannel.trim()}: ${form.profile.primaryContactHandle.trim()}` });
    const parsed = workspaceApplicationInputSchema.safeParse({ ...form, profile: normalizePortalProfileInput(form.profile), application: normalized, turnstileToken: token ?? undefined });
    if (!parsed.success) { setError("请补全署名、B站 UID、联系方式和创作计划，并选择一个发布时点。请检查邮箱和链接格式。"); return; }
    setSaving(true);
    try {
      const response = await requestJson<WorkspaceApplicationResponse>("/api/portal/application-with-segment", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data) });
      setMessage(response.message);
      await onSaved().catch(() => setRefreshWarning("操作已完成，但摘要暂未更新，请稍后刷新。"));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "报名保存失败，请保留资料后重试。"); }
    finally { setSaving(false); if (required) { setToken(null); window.turnstile?.reset(widgetRef.current); } }
  }

  async function saveProfile() {
    setError(null); setMessage(null); setRefreshWarning(null);
    const parsed = updatePortalProfileInputSchema.safeParse(normalizePortalProfileInput(form.profile));
    if (!parsed.success) { setError("请补全署名、B站 UID 和联系方式。"); return; }
    setSavingProfile(true);
    try {
      const response = await requestJson<PortalProfileMutationResponse>("/api/portal/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data) });
      setMessage(response.message);
      await onSaved().catch(() => setRefreshWarning("信息已保存，但摘要暂未更新，请稍后刷新。"));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "信息保存失败。"); }
    finally { setSavingProfile(false); }
  }

  const profileField = (key: "creditName" | "bilibiliUid" | "contactEmail" | "primaryContactChannel" | "primaryContactHandle" | "backupContact", label: string, type = "text") => (
    <Field label={label} hint={key === "bilibiliUid" ? "数字 UID，用于相邻作者联系，不在公开作品页展示。" : undefined}><input form="creator-registration-form" className="field-input" type={type} inputMode={key === "bilibiliUid" ? "numeric" : undefined} pattern={key === "bilibiliUid" ? "[0-9]+" : undefined} maxLength={key === "bilibiliUid" ? 20 : undefined} disabled={compact ? saving || savingProfile : disabled} value={form.profile[key] ?? ""} required={key !== "backupContact"} onChange={event => setForm(current => ({ ...current, profile: { ...current.profile, [key]: event.target.value } }))} /></Field>
  );
  if (application.application?.status === "approved") return <div className="space-y-4">
    <Notice>报名已通过，创作计划已锁定。可以在排期区块调整时间，或在作品资料中补充正式内容。</Notice>
    <p>参加形式：{applicationInterestFormatLabels[application.application.interestFormat]}</p>
    <p>{application.application.introText || "未填写创作简介。"}</p>
    {application.application.portfolioUrl ? <p>作品或主页：<a className="text-link" href={application.application.portfolioUrl} target="_blank" rel="noreferrer">{application.application.portfolioUrl}</a></p> : null}
    {application.application.messageToHosts ? <p>给主催的话：{application.application.messageToHosts}</p> : null}
  </div>;
  return <div className={compact ? "creator-board" : "space-y-6"}><form hidden id="creator-registration-form" onSubmit={event => void submit(event)} />
    <section className={compact ? "creator-card creator-profile-card" : undefined} id={compact ? "profile" : undefined}>
      {compact ? <header className="creator-card-header"><h2 className="creator-card-title">我的信息</h2></header> : null}
      <div className={compact ? "creator-card-body" : undefined}>
    <fieldset className="form-section" disabled={compact ? saving || savingProfile : disabled} onKeyDown={event => {
      if (compact && event.key === "Enter" && event.target instanceof HTMLInputElement && !event.nativeEvent.isComposing) {
        event.preventDefault();
        if (!saving && !savingProfile) void saveProfile();
      }
    }}>
      <legend>署名与联系方式</legend>
      <div className="workspace-form-grid">
        {profileField("creditName", "署名")}{profileField("bilibiliUid", "B站 UID")}{profileField("contactEmail", "联系邮箱", "email")}
        {profileField("primaryContactChannel", "联系渠道")}{profileField("primaryContactHandle", "联系账号")}
        {profileField("backupContact", "备用联系方式（选填）")}
      </div>
      <label className="checkbox-field"><input form="creator-registration-form" type="checkbox" checked={form.profile.isAnonymous} onChange={event => setForm(current => ({ ...current, profile: { ...current.profile, isAnonymous: event.target.checked } }))} />匿名展示</label>
      <p className="field-hint">匿名只影响公开展示，主催仍可查看署名和联系方式。</p>
    </fieldset>
    {compact ? <><Button type="button" variant="secondary" disabled={saving || savingProfile} onClick={() => void saveProfile()}>{savingProfile ? "保存中…" : "保存信息"}</Button><details className="compact-editor"><summary>登录与密码</summary><div className="space-y-4"><Field label="登录邮箱"><input className="field-input" value={application.user.email} readOnly type="email" /></Field><PasswordSettings /></div></details></> : null}
      </div>
    </section>
    <section className={compact ? "creator-card creator-work-card" : undefined} id={compact ? "plan" : undefined}>
      {compact ? <header className="creator-card-header"><h2 className="creator-card-title">当前创作计划</h2><a className="text-link" href="#schedule">完整排期</a></header> : null}
      <div className={compact ? "creator-card-body" : undefined}>
    {!editable ? <Notice>{`${getApplicationWindowLabel(application.window)}，暂时不能提交或修改报名。`}</Notice> : <p>填写联系方式、创作计划并选择发布时点。提交后会先预留发布时点，审核通过后确认。</p>}
    {compact && application.application ? <div className="creator-work-summary"><h3>{applicationInterestFormatLabels[application.application.interestFormat]}</h3><p>{application.application.introText || "简介待填写"}</p>{application.application.portfolioUrl ? <a className="text-link" href={application.application.portfolioUrl} target="_blank" rel="noreferrer">作品或主页</a> : null}</div> : null}
    <details className="compact-editor" open={!compact || !application.application ? true : undefined}><summary>编辑创作计划</summary>
    <fieldset className="form-section" disabled={disabled}>
      <legend>创作计划</legend>
      <div className="workspace-form-grid">
        <Field label="参加形式"><select form="creator-registration-form" className="field-input" value={form.application.interestFormat} onChange={event => setForm(current => ({ ...current, application: { ...current.application, interestFormat: event.target.value as WorkspaceApplicationInput["application"]["interestFormat"] } }))}>{Object.entries(applicationInterestFormatLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="作品或主页链接（选填）"><input form="creator-registration-form" type="url" className="field-input" value={form.application.portfolioUrl ?? ""} onChange={event => setForm(current => ({ ...current, application: { ...current.application, portfolioUrl: event.target.value } }))} /></Field>
      </div>
      <Field label="创作简介"><textarea form="creator-registration-form" className="field-input" rows={5} value={form.application.introText ?? ""} onChange={event => setForm(current => ({ ...current, application: { ...current.application, introText: event.target.value } }))} /></Field>
      <Field label="给主催的话（选填）"><textarea form="creator-registration-form" className="field-input" rows={3} value={form.application.messageToHosts ?? ""} onChange={event => setForm(current => ({ ...current, application: { ...current.application, messageToHosts: event.target.value } }))} /></Field>
    </fieldset>
    </details>
    <details className="compact-editor" open={compact ? undefined : true}><summary>{form.segmentId ? `已选发布时点：${formatScheduledTime(collaboration.segments.find(segment => segment.id === form.segmentId)?.scheduledAt)}（调整）` : "选择报名发布时点"}</summary>
    <fieldset className="form-section">
      <legend>选择报名发布时点</legend>
      <ScheduleGrid
        segments={collaboration.segments}
        participantId={collaboration.participantId}
        selectedSegmentId={form.segmentId}
        canChoose={!disabled}
        onChoose={segment => setForm(current => ({ ...current, segmentId: segment.id }))}
      />
    </fieldset>
    </details>
    {required && editable ? <Field label="人机验证"><div ref={containerRef} />{!siteKey ? <span>验证设置暂不可用，请联系主催。</span> : null}</Field> : null}
    {message ? <Notice tone="success">{message}</Notice> : null}{refreshWarning ? <Notice tone="warning">{refreshWarning}</Notice> : null}{error ? <Notice tone="error">{error}</Notice> : null}
    <div className="workspace-actions"><Button form="creator-registration-form" type="submit" disabled={disabled || !intake || (required && !token)} aria-busy={saving}>{saving ? "提交中…" : application.application ? "更新报名与预留发布时点" : "提交报名并预留发布时点"}</Button></div>
      </div>
    </section>
  </div>;
}
