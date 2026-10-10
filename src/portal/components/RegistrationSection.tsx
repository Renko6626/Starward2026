import { formatScheduledTime } from "../../app/lib/format";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Field, Notice } from "../../app/components/ui";
import { requestJson } from "../../app/lib/api";
import { getTurnstileSiteKey, normalizeApplicationInput } from "../../app/lib/apply-form";
import { loadTurnstileApi } from "../../app/lib/turnstile";
import { applicationInterestFormatLabels, type ApplicationIntakeResponse } from "../../shared/applications";
import { workspaceApplicationInputSchema, type CollaborationResponse, type WorkspaceApplicationInput, type WorkspaceApplicationResponse } from "../../shared/collaboration";
import { updatePortalProfileInputSchema, type PortalProfileMutationResponse, type PortalApplicationResponse } from "../../shared/portal";
import { getApplicationWindowLabel } from "../../shared/windows";
import { getBilibiliProfileUrl, normalizePortalProfileInput, portalContactChannels, portalProfilePlaceholders } from "../lib/profile-form";
import { LoginPasswordDialog } from "./LoginPasswordDialog";
import { parseRegistrationDraft, registrationDraftKey } from "../lib/registration-draft";
import { isRegistrationSegmentSelectable, readScheduleIntent, requiresRegistrationTimeConfirmation, saveScheduleIntent, type RegistrationTimeChange } from "../lib/schedule-selection";
import { getRegistrationFieldErrors } from "../lib/registration-validation";

export function RegistrationSection({ application, collaboration, onSaved, compact = false, onSelectionChange }: {
  compact?: boolean;
  application: PortalApplicationResponse;
  collaboration: CollaborationResponse;
  onSaved: () => Promise<void>;
  onSelectionChange?: (segmentId: string) => void;
}) {
  const { segment } = getRouteApi("/portal/").useSearch();
  const navigate = useNavigate();
  const [form, setForm] = useState<WorkspaceApplicationInput>(() => ({
    profile: {
      creditName: application.profile?.creditName ?? "",
      bilibiliUid: application.profile?.bilibiliUid ?? "",
      contactEmail: application.profile ? application.profile.contactEmail : application.user.email,
      primaryContactChannel: application.profile?.primaryContactChannel ?? "QQ",
      primaryContactHandle: application.profile?.primaryContactHandle ?? "",
      backupContact: application.profile?.backupContact ?? "",
      isAnonymous: application.profile?.isAnonymous ?? true,
    },
    application: {
      contactEmail: application.application ? application.application.contactEmail : application.profile ? application.profile.contactEmail : application.user.email,
      contactHandle: application.application?.contactHandle ?? "",
      interestFormat: application.application?.interestFormat ?? "novel",
      introText: application.application?.introText ?? "",
      portfolioUrl: application.application?.portfolioUrl ?? "",
      messageToHosts: application.application?.messageToHosts ?? "",
    },
    segmentId: collaboration.segments.find(item => item.participantId === collaboration.participantId)?.id ?? "",
  }));
  const [draftReady, setDraftReady] = useState(false);
  const draftLoaded = useRef(false);
  useEffect(() => { onSelectionChange?.(form.segmentId); }, [form.segmentId, onSelectionChange]);
  useEffect(() => {
    if (!draftLoaded.current) {
      let draft: ReturnType<typeof parseRegistrationDraft> = null;
      try { draft = parseRegistrationDraft(sessionStorage.getItem(registrationDraftKey(application.user.id))); } catch { /* Storage may be disabled. */ }
      const intent = readScheduleIntent(application.user.id);
      setForm(current => ({ ...current, ...(application.editable && draft ? draft : {}), ...(intent && application.editable ? { segmentId: intent } : {}) }));
      draftLoaded.current = true;
      setDraftReady(true);
    }
    if (segment && application.editable) {
      setForm(current => ({ ...current, segmentId: segment }));
      saveScheduleIntent(application.user.id, segment);
      // Consume the incoming choice so a later dropdown change survives refresh.
      void navigate({ to: "/portal", search: {}, hash: window.location.hash.slice(1) || undefined, replace: true });
    }
  }, [application.user.id, segment, application.editable, navigate]);
  useEffect(() => {
    if (!draftReady || !application.editable) return;
    try { sessionStorage.setItem(registrationDraftKey(application.user.id), JSON.stringify(form)); } catch { /* Keep the live form usable. */ }
    saveScheduleIntent(application.user.id, form.segmentId);
  }, [form, draftReady, application.user.id, application.editable]);
  const selectedSegment = collaboration.segments.find(item => item.id === form.segmentId);
  const selectionUnavailable = Boolean(form.segmentId && (!selectedSegment || !isRegistrationSegmentSelectable(selectedSegment, collaboration.participantId)));
  const selectableSegments = collaboration.segments.filter(item => isRegistrationSegmentSelectable(item, collaboration.participantId));
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const formContainerRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [timeChangeConfirmation, setTimeChangeConfirmation] = useState<RegistrationTimeChange | null>(null);
  const timeChangeDialog = useRef<HTMLDialogElement>(null);
  const [intake, setIntake] = useState<ApplicationIntakeResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | undefined>(undefined);
  const siteKey = getTurnstileSiteKey(import.meta.env);
  const required = Boolean(intake?.turnstileEnabled);
  const editable = application.editable;
  const disabled = !editable || saving || savingProfile;
  useEffect(() => {
    const dialog = timeChangeDialog.current;
    if (!timeChangeConfirmation || !dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      trigger?.focus({ preventScroll: true });
    };
  }, [timeChangeConfirmation]);
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

  function showFieldErrors(errors: Record<string, string>) {
    setFieldErrors(errors);
    setError("请修正标出的字段后重试。");
    requestAnimationFrame(() => {
      const input = formContainerRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      input?.scrollIntoView({ block: "center" });
      input?.focus({ preventScroll: true });
    });
  }

  async function submit(event?: FormEvent<HTMLFormElement>, confirmedChange?: RegistrationTimeChange) {
    event?.preventDefault();
    if (saving || savingProfile) return;
    setTimeChangeConfirmation(null);
    setError(null); setMessage(null); setProfileMessage(null); setRefreshWarning(null); setFieldErrors({});
    if (!editable || !intake) { setError("报名设置尚未就绪或当前不能修改报名。"); return; }
    const normalized = normalizeApplicationInput({ ...form.application, portfolioUrl: application.application?.portfolioUrl ?? undefined, messageToHosts: application.application?.messageToHosts ?? undefined, contactEmail: form.profile.contactEmail, contactHandle: `${form.profile.primaryContactChannel.trim()}: ${form.profile.primaryContactHandle.trim()}` });
    const parsed = workspaceApplicationInputSchema.safeParse({ ...form, profile: normalizePortalProfileInput(form.profile, application.user.email), application: normalized, turnstileToken: token ?? undefined });
    const validationErrors: Record<string, string> = parsed.success ? {} : getRegistrationFieldErrors(parsed.error.issues);
    if (!selectedSegment || selectionUnavailable) validationErrors.segmentId = "请选择一个可用的发布时间，已填写的信息会保留。";
    if (Object.keys(validationErrors).length) { showFieldErrors(validationErrors); return; }
    if (!parsed.success) { setError("报名资料格式不正确，请检查后重试。"); return; }
    if (required && (!siteKey || !token)) { setError("请先完成人机验证后再提交。"); return; }
    const currentSegment = collaboration.segments.find(item => item.participantId === collaboration.participantId);
    if (selectedSegment && requiresRegistrationTimeConfirmation(currentSegment, selectedSegment, confirmedChange)) {
      setTimeChangeConfirmation({ from: currentSegment!, to: selectedSegment });
      return;
    }
    setSaving(true);
    try {
      const response = await requestJson<WorkspaceApplicationResponse>("/api/portal/application-with-segment", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data) });
      setMessage(response.message);
      try { sessionStorage.removeItem(registrationDraftKey(application.user.id)); } catch { /* Storage may be disabled. */ }
      saveScheduleIntent(application.user.id, "");
      await onSaved().catch(() => setRefreshWarning("报名已提交，页面暂未更新，请点击“刷新状态”。"));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "报名保存失败，请保留资料后重试。"); }
    finally { setSaving(false); if (required) { setToken(null); window.turnstile?.reset(widgetRef.current); } }
  }

  async function saveProfile() {
    setError(null); setMessage(null); setProfileMessage(null); setRefreshWarning(null); setFieldErrors({});
    const parsed = updatePortalProfileInputSchema.safeParse(normalizePortalProfileInput(form.profile, application.user.email));
    if (!parsed.success) { showFieldErrors(getRegistrationFieldErrors(parsed.error.issues, "profile")); return; }
    setSavingProfile(true);
    try {
      await requestJson<PortalProfileMutationResponse>("/api/portal/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data) });
      setProfileMessage(application.application
        ? "署名与联系已保存。报名内容和发布时间以提交报名时为准。"
        : "署名与联系已保存。填写创作意向并选择发布时间后，可提交报名。");
      await onSaved().catch(() => setRefreshWarning("署名与联系已保存，页面暂未更新，请点击“刷新状态”。"));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "署名与联系保存失败。"); }
    finally { setSavingProfile(false); }
  }

  const profileField = (key: "creditName" | "bilibiliUid" | "contactEmail" | "primaryContactChannel" | "primaryContactHandle" | "backupContact", label: string, type = "text") => (
    <Field label={label} error={fieldErrors[`profile.${key}`]}><input name={`profile.${key}`} form="creator-registration-form" className="field-input" type={type} maxLength={key === "bilibiliUid" ? 512 : undefined} placeholder={portalProfilePlaceholders[key]} disabled={compact ? saving || savingProfile : disabled} value={form.profile[key] ?? ""} required={key !== "backupContact" && key !== "contactEmail"} onChange={event => setForm(current => ({ ...current, profile: { ...current.profile, [key]: event.target.value } }))} />{key === "bilibiliUid" && getBilibiliProfileUrl(form.profile.bilibiliUid) ? <a className="text-link" href={getBilibiliProfileUrl(form.profile.bilibiliUid)} target="_blank" rel="noreferrer">访问我的 B站主页</a> : null}</Field>
  );
  if (application.application?.status === "approved") return <div className="space-y-4">
    <Notice>报名已通过，可以安心创作。这里保留原报名资料，作品完成后再正式提交；开放期间可调整或申请换期。</Notice>
    <p>参加形式：{applicationInterestFormatLabels[application.application.interestFormat]}</p>
    <p>{application.application.introText || "未填写创作意向。"}</p>
    {application.application.portfolioUrl ? <p>作品或主页：<a className="text-link" href={application.application.portfolioUrl} target="_blank" rel="noreferrer">{application.application.portfolioUrl}</a></p> : null}
    {application.application.messageToHosts ? <p>给主催的话：{application.application.messageToHosts}</p> : null}
  </div>;
  return <div ref={formContainerRef} className={compact ? "creator-board creator-board--registration" : "space-y-6"} onChangeCapture={event => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
    const key = target.name;
    if (key.startsWith("profile.")) setProfileMessage(null);
    if (fieldErrors[key]) {
      setFieldErrors(current => { const next = { ...current }; delete next[key]; return next; });
      setError(null);
    }
  }}><form hidden noValidate id="creator-registration-form" onSubmit={event => void submit(event)} />
    <dialog ref={timeChangeDialog} className="registration-time-dialog" aria-labelledby="registration-time-dialog-title"
      aria-describedby="registration-time-dialog-description"
      onCancel={event => { event.preventDefault(); setTimeChangeConfirmation(null); }}>
      {timeChangeConfirmation ? <>
        <h2 id="registration-time-dialog-title">确认更改发布时间？</h2>
        <dl className="registration-time-change">
          <div><dt>原时间</dt><dd>{timeChangeConfirmation.from.scheduledAt ? formatScheduledTime(timeChangeConfirmation.from.scheduledAt) : timeChangeConfirmation.from.name}</dd></div>
          <div><dt>新时间</dt><dd>{timeChangeConfirmation.to.scheduledAt ? formatScheduledTime(timeChangeConfirmation.to.scheduledAt) : timeChangeConfirmation.to.name}</dd></div>
        </dl>
        <p id="registration-time-dialog-description">以上时间均为北京时间。确认后将更新报名、释放原时间，并尝试预留新时间。如果新时间已被占用，原报名和时间保持不变。</p>
        <div className="workspace-actions">
          <Button variant="secondary" autoFocus onClick={() => setTimeChangeConfirmation(null)}>返回修改</Button>
          <Button onClick={() => void submit(undefined, timeChangeConfirmation)}>确认更改并提交</Button>
        </div>
      </> : null}
    </dialog>
    <section className={compact ? "creator-card creator-profile-card" : undefined} id={compact ? "profile" : undefined}>
      {compact ? <header className="creator-card-header"><h2 className="creator-card-title">署名与联系</h2><LoginPasswordDialog email={application.user.email} /></header> : null}
      <div className={compact ? "creator-card-body" : undefined}>
    <fieldset className="form-section" aria-label="署名与联系" disabled={compact ? saving || savingProfile : disabled} onKeyDown={event => {
      if (compact && event.key === "Enter" && event.target instanceof HTMLInputElement && !event.nativeEvent.isComposing) {
        event.preventDefault();
        if (!saving && !savingProfile) void saveProfile();
      }
    }}>
      <div className="workspace-form-grid">
        {profileField("creditName", "署名")}{profileField("bilibiliUid", "B站主页链接或 UID")}{profileField("contactEmail", "联系邮箱（选填）", "email")}
        <Field label="联系渠道" error={fieldErrors["profile.primaryContactChannel"]}><select name="profile.primaryContactChannel" form="creator-registration-form" className="field-input" disabled={compact ? saving || savingProfile : disabled} value={form.profile.primaryContactChannel} onChange={event => setForm(current => ({ ...current, profile: { ...current.profile, primaryContactChannel: event.target.value } }))}>{!portalContactChannels.includes(form.profile.primaryContactChannel) ? <option value={form.profile.primaryContactChannel}>{form.profile.primaryContactChannel}</option> : null}{portalContactChannels.map(channel => <option key={channel} value={channel}>{channel === "Email" ? "邮箱" : channel}</option>)}</select></Field>{profileField("primaryContactHandle", "联系账号")}
        {profileField("backupContact", "备用联系方式（选填）")}
      </div>
      <label className="checkbox-field"><input name="profile.isAnonymous" form="creator-registration-form" type="checkbox" checked={form.profile.isAnonymous} onChange={event => setForm(current => ({ ...current, profile: { ...current.profile, isAnonymous: event.target.checked } }))} />匿名展示</label>
      <p className="field-hint">匿名时公开页面不显示署名；主催仍可查看资料，已确认排期的相邻作者可查看你的 B站主页。</p>
    </fieldset>
    {compact ? <><Button type="button" variant="secondary" disabled={saving || savingProfile} onClick={() => void saveProfile()}>{savingProfile ? "保存中…" : "仅保存署名与联系"}</Button></> : null}
    {profileMessage ? <Notice tone="success">{profileMessage}</Notice> : null}
      </div>
    </section>
    <section className={compact ? "creator-card creator-work-card creator-registration-card" : undefined} id={compact ? "plan" : undefined}>
      {compact ? <header className="creator-card-header"><h2 className="creator-card-title">报名信息</h2></header> : null}
      <div className={compact ? "creator-card-body" : undefined}>
    {!editable ? <Notice>{`${getApplicationWindowLabel(application.window)}，暂时不能提交或修改报名。`}</Notice> : null}
    <fieldset className="form-section" aria-label="创作意向" disabled={disabled}>
      <div className="workspace-form-grid">
        <Field label="预计作品类型" error={fieldErrors["application.interestFormat"]}><select name="application.interestFormat" form="creator-registration-form" className="field-input" value={form.application.interestFormat} onChange={event => setForm(current => ({ ...current, application: { ...current.application, interestFormat: event.target.value as WorkspaceApplicationInput["application"]["interestFormat"] } }))}>{Object.entries(applicationInterestFormatLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      </div>
      <Field label="创作意向（必填）" error={fieldErrors["application.introText"]}><textarea name="application.introText" form="creator-registration-form" className="field-input" rows={3} required maxLength={1600} placeholder="简要介绍计划创作的题材、内容和形式。报名时只需填写意向。" value={form.application.introText ?? ""} onChange={event => setForm(current => ({ ...current, application: { ...current.application, introText: event.target.value } }))} /></Field>
    </fieldset>
    {editable || selectionUnavailable ? <section className="registration-time-summary" aria-label="报名发布时间">
      {editable ? <Field label="发布时间（北京时间）" error={fieldErrors.segmentId}>
        <select name="segmentId" form="creator-registration-form" className="field-input" required disabled={disabled}
          value={form.segmentId} onChange={event => setForm(current => ({ ...current, segmentId: event.target.value }))}>
          <option value="">请选择发布时间</option>
          {selectionUnavailable ? <option value={form.segmentId} disabled>{selectedSegment ? `${formatScheduledTime(selectedSegment.scheduledAt)}（已不可选）` : "原选时间已不可用"}</option> : null}
          {selectableSegments.map(item => <option key={item.id} value={item.id}>
            {item.scheduledAt ? formatScheduledTime(item.scheduledAt) : item.name}{item.status === "reserved" ? "（已为你预留）" : ""}
          </option>)}
        </select>
        {selectableSegments.length === 0 ? <p className="field-hint">当前没有可选时间，请稍后查看时间表。</p> : null}
      </Field> : null}
      {selectionUnavailable ? <Notice tone="warning">所选时间已不可用，请重新选择。</Notice> : null}
      {editable ? <Link className="button button--secondary" to="/works" search={{ q: "", type: "all", view: "gallery" }}>查看完整时间表</Link> : null}
    </section> : null}
    {required && editable ? <Field label="人机验证"><div ref={containerRef} />{!siteKey ? <span>验证设置暂不可用，请联系主催。</span> : null}</Field> : null}
    {message ? <Notice tone="success">{message}</Notice> : null}{refreshWarning ? <Notice tone="warning">{refreshWarning}</Notice> : null}{error ? <Notice tone="error">{error}</Notice> : null}
    <div className="registration-submit">
      <div className="workspace-actions"><Button form="creator-registration-form" type="submit" disabled={disabled || !intake || (required && !token)} aria-busy={saving}>{saving ? "提交中…" : application.application?.status === "pending" ? "更新报名" : application.application ? "重新提交报名" : "提交报名"}</Button></div>
      <p className="registration-submit-note">提交时一并保存署名与联系、创作意向，并预留所选发布时间。请按时完成作品并保持联系畅通。</p>
    </div>
      </div>
    </section>
  </div>;
}
