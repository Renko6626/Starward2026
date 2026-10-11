import { useSiteTranslation } from "../../i18n/use-site-translation";
import { ArchiveChapter, revealArchiveTarget } from "./ArchiveChapter";
import { ArchiveResult } from "./ArchiveResult";
import { formatScheduledTime } from "../../app/lib/format";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Field, Notice } from "../../app/components/ui";
import { requestJson } from "../../app/lib/api";
import { normalizeApplicationInput } from "../../app/lib/apply-form";
import { applicationInterestFormatLabels, updateApplicationIntentInputSchema } from "../../shared/applications";
import { workspaceApplicationInputSchema, type CollaborationResponse, type WorkspaceApplicationInput, type WorkspaceApplicationResponse } from "../../shared/collaboration";
import { updatePortalProfileInputSchema, type PortalProfileMutationResponse, type PortalApplicationResponse } from "../../shared/portal";
import { getApplicationWindowLabel } from "../../shared/windows";
import { getBilibiliProfileUrl, normalizePortalProfileInput, portalContactChannels, portalProfilePlaceholders } from "../lib/profile-form";
import { useDialogMotion } from "../../app/components/use-dialog-motion";
import { LoginPasswordDialog } from "./LoginPasswordDialog";
import { parseRegistrationDraft, registrationDraftKey } from "../lib/registration-draft";
import { isRegistrationSegmentSelectable, readScheduleIntent, requiresRegistrationTimeConfirmation, saveScheduleIntent, type RegistrationTimeChange } from "../lib/schedule-selection";
import { getRegistrationFieldErrors } from "../lib/registration-validation";
import { localizeSegmentName } from "../../shared/i18n";

export function RegistrationSection({ application, collaboration, onSaved, compact = false }: {
  compact?: boolean;
  application: PortalApplicationResponse;
  collaboration: CollaborationResponse;
  onSaved: () => Promise<void>;
}) {
  const { t, language, label: systemLabel } = useSiteTranslation();
  const { segment } = getRouteApi("/portal/").useSearch();
  const navigate = useNavigate();
  const [form, setForm] = useState<Omit<WorkspaceApplicationInput, "segmentId"> & { segmentId: string }>(() => ({
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
  useEffect(() => {
    if (!draftLoaded.current) {
      let draft: ReturnType<typeof parseRegistrationDraft> = null;
      try { draft = parseRegistrationDraft(sessionStorage.getItem(registrationDraftKey(application.user.id))); } catch { /* Storage may be disabled. */ }
      const intent = readScheduleIntent(application.user.id);
      setForm(current => ({ ...current, ...(application.editable && draft ? draft : {}), ...(intent && application.editable ? { segmentId: intent } : {}) }));
      draftLoaded.current = true;
      setDraftReady(true);
    }
    // An explicit empty choice means host arrangement and overrides the saved draft.
    if (segment !== undefined && application.editable) {
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
  const assignedSegment = collaboration.segments.find(item => item.participantId === collaboration.participantId);
  const assignmentFrozen = assignedSegment?.assignmentStatus === "locked" || assignedSegment?.assignmentStatus === "completed";
  useEffect(() => {
    if (assignmentFrozen && assignedSegment) setForm(current => ({ ...current, segmentId: assignedSegment.id }));
  }, [assignmentFrozen, assignedSegment?.id]);
  const selectedSegment = collaboration.segments.find(item => item.id === form.segmentId);
  const selectionUnavailable = application.editable && Boolean(form.segmentId && (!selectedSegment || !isRegistrationSegmentSelectable(selectedSegment, collaboration.participantId)));
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
  const { enter: enterDialog, exit: exitDialog, stop: stopDialog } = useDialogMotion(timeChangeDialog);
  const editable = application.editable;
  const unifiedPendingSave = editable && application.application?.status === "pending";
  const canSaveProfileSeparately = compact && !unifiedPendingSave && (!editable || Boolean(application.application));
  const approved = application.application?.status === "approved";
  const intentEditable = editable || approved;
  const intentDisabled = !intentEditable || saving || savingProfile;
  const disabled = !editable || saving || savingProfile;
  useEffect(() => {
    const dialog = timeChangeDialog.current;
    if (!timeChangeConfirmation || !dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    enterDialog();
    document.body.style.overflow = "hidden";
    return () => {
      stopDialog();
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      trigger?.focus({ preventScroll: true });
    };
  }, [timeChangeConfirmation, enterDialog, stopDialog]);
  function showFieldErrors(errors: Record<string, string>) {
    setFieldErrors(errors);
    setError(t("portal.validation.correctFields"));
    requestAnimationFrame(() => {
      const input = formContainerRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      if (input) revealArchiveTarget(input);
      input?.scrollIntoView({ block: "center" });
      input?.focus({ preventScroll: true });
    });
  }

  async function submit(event?: FormEvent<HTMLFormElement>, confirmedChange?: RegistrationTimeChange) {
    event?.preventDefault();
    if (saving || savingProfile) return;
    if (approved) { await saveIntent(); return; }
    if (confirmedChange) exitDialog(() => setTimeChangeConfirmation(null));
    else setTimeChangeConfirmation(null);
    setError(null); setMessage(null); setProfileMessage(null); setRefreshWarning(null); setFieldErrors({});
    if (!editable) { setError(t("portal.registration.editClosed")); return; }
    const normalized = normalizeApplicationInput({ ...form.application, portfolioUrl: application.application?.portfolioUrl ?? undefined, messageToHosts: application.application?.messageToHosts ?? undefined, contactEmail: form.profile.contactEmail, contactHandle: `${form.profile.primaryContactChannel.trim()}: ${form.profile.primaryContactHandle.trim()}` });
    const parsed = workspaceApplicationInputSchema.safeParse({ ...form, profile: normalizePortalProfileInput(form.profile, application.user.email), application: normalized, segmentId: form.segmentId || null });
    const validationErrors: Record<string, string> = parsed.success ? {} : getRegistrationFieldErrors(parsed.error.issues, undefined, language);
    if (selectionUnavailable) validationErrors.segmentId = t("portal.validation.availableTime");
    if (Object.keys(validationErrors).length) { showFieldErrors(validationErrors); return; }
    if (!parsed.success) { setError(t("portal.validation.registrationFormat")); return; }
    const currentSegment = collaboration.segments.find(item => item.participantId === collaboration.participantId);
    if (requiresRegistrationTimeConfirmation(currentSegment, selectedSegment ?? null, confirmedChange)) {
      setTimeChangeConfirmation({ from: currentSegment!, to: selectedSegment ?? null });
      return;
    }
    setSaving(true);
    try {
      const response = await requestJson<WorkspaceApplicationResponse>("/api/portal/application-with-segment", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data) });
      setMessage(response.message);
      try { sessionStorage.removeItem(registrationDraftKey(application.user.id)); } catch { /* Storage may be disabled. */ }
      saveScheduleIntent(application.user.id, "");
      await onSaved().catch(() => setRefreshWarning(t("portal.registration.submittedRefresh")));
    } catch (caught) { setError(caught instanceof Error ? caught.message : t("portal.registration.saveError")); }
    finally { setSaving(false); }
  }

  async function saveProfile() {
    setError(null); setMessage(null); setProfileMessage(null); setRefreshWarning(null); setFieldErrors({});
    const parsed = updatePortalProfileInputSchema.safeParse(normalizePortalProfileInput(form.profile, application.user.email));
    if (!parsed.success) { showFieldErrors(getRegistrationFieldErrors(parsed.error.issues, "profile", language)); return; }
    setSavingProfile(true);
    try {
      await requestJson<PortalProfileMutationResponse>("/api/portal/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data) });
      setProfileMessage(application.application
        ? t("portal.profile.savedWithRegistration")
        : t("portal.profile.savedBeforeRegistration"));
      await onSaved().catch(() => setRefreshWarning(t("portal.profile.savedStatusRefresh")));
    } catch (caught) { setError(caught instanceof Error ? caught.message : t("portal.profile.creditSaveError")); }
    finally { setSavingProfile(false); }
  }

  async function saveIntent() {
    setError(null); setMessage(null); setRefreshWarning(null); setFieldErrors({});
    const parsed = updateApplicationIntentInputSchema.safeParse({ interestFormat: form.application.interestFormat, introText: form.application.introText });
    if (!parsed.success) { showFieldErrors(getRegistrationFieldErrors(parsed.error.issues, "application", language)); return; }
    setSaving(true);
    try {
      const response = await requestJson<WorkspaceApplicationResponse>("/api/portal/application", {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data),
      });
      setMessage(response.message);
      await onSaved().catch(() => setRefreshWarning(t("portal.registration.intentSavedRefresh")));
    } catch (caught) { setError(caught instanceof Error ? caught.message : t("portal.registration.intentSaveError")); }
    finally { setSaving(false); }
  }

  const submitControls = intentEditable ? <div className={`registration-submit${approved ? " registration-submit--intent" : ""}`}>
      <div className="workspace-actions archive-control-actions">
        {compact && !approved ? <span className="archive-control-label" aria-hidden="true">REG / SUBMIT</span> : null}
        {editable ? <Link className={`button button--secondary${compact ? " button--industrial" : ""}`} to="/works" search={{ q: "", type: "all", view: "gallery" }}>{t("portal.schedule.viewAll")}</Link> : null}
        <Button appearance={compact ? approved ? "industrial" : "framed" : "default"} variant={approved ? "secondary" : "primary"} className={approved ? undefined : "button--accent"} form="creator-registration-form" type="submit" disabled={intentDisabled} aria-busy={saving}>{saving ? approved ? t("portal.common.saving") : t("portal.common.submitting") : approved ? t("portal.registration.saveIntent") : application.application?.status === "pending" ? t("portal.registration.update") : application.application ? t("portal.registration.resubmit") : t("portal.registration.submit")}</Button>
      </div>
      <p className="registration-submit-note">{approved ? t("portal.registration.intentSaveHint") : t("portal.registration.submitHint")}</p>
    </div> : null;

  const profileField = (key: "creditName" | "bilibiliUid" | "contactEmail" | "primaryContactChannel" | "primaryContactHandle" | "backupContact", label: string, type = "text") => {
    const required = key !== "backupContact" && key !== "contactEmail";
    return <Field label={label} requirement={required ? "必填" : "选填"} hint={key === "bilibiliUid" ? t("portal.profile.bilibiliHint") : undefined} error={fieldErrors[`profile.${key}`]}><input name={`profile.${key}`} form="creator-registration-form" className="field-input" type={type} maxLength={key === "bilibiliUid" ? 512 : undefined} placeholder={systemLabel(portalProfilePlaceholders[key])} disabled={compact ? saving || savingProfile : disabled} value={form.profile[key] ?? ""} required={required} onChange={event => setForm(current => ({ ...current, profile: { ...current.profile, [key]: event.target.value } }))} />{key === "bilibiliUid" && getBilibiliProfileUrl(form.profile.bilibiliUid) ? <a className="text-link" href={getBilibiliProfileUrl(form.profile.bilibiliUid)} target="_blank" rel="noreferrer">{t("portal.profile.visitBilibili")}</a> : null}</Field>;
  };
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
      onCancel={event => { event.preventDefault(); exitDialog(() => setTimeChangeConfirmation(null)); }}>
      {timeChangeConfirmation ? <>
        <h2 id="registration-time-dialog-title">{t("portal.schedule.changeConfirm")}</h2>
        <dl className="registration-time-change">
          <div><dt>{t("portal.schedule.previousTime")}</dt><dd>{timeChangeConfirmation.from.scheduledAt ? formatScheduledTime(timeChangeConfirmation.from.scheduledAt, language) : localizeSegmentName(collaboration.segments.find(item => item.id === timeChangeConfirmation.from.id)?.code, timeChangeConfirmation.from.name, language)}</dd></div>
          <div><dt>{t("portal.schedule.newTime")}</dt><dd>{timeChangeConfirmation.to?.scheduledAt ? formatScheduledTime(timeChangeConfirmation.to.scheduledAt, language) : timeChangeConfirmation.to ? localizeSegmentName(collaboration.segments.find(item => item.id === timeChangeConfirmation.to?.id)?.code, timeChangeConfirmation.to.name, language) : t("portal.schedule.hostArranged")}</dd></div>
        </dl>
        <p id="registration-time-dialog-description">{timeChangeConfirmation.to ? t("portal.schedule.changeHint") : t("portal.schedule.releaseForHostHint")}</p>
        <div className="workspace-actions">
          <Button appearance={compact ? "industrial" : "default"} variant="secondary" autoFocus onClick={() => exitDialog(() => setTimeChangeConfirmation(null))}>{t("portal.schedule.backToEdit")}</Button>
          <Button appearance={compact ? "industrial" : "default"} disabled={saving} aria-busy={saving} onClick={() => void submit(undefined, timeChangeConfirmation)}>{t("portal.schedule.confirmSubmit")}</Button>
        </div>
      </> : null}
    </dialog>
    <ArchiveChapter enabled={compact} id="profile" number="01" title={t("portal.profile.basic")} state={application.profile?.creditName} defaultOpen={!application.profile || !application.application}>
      <LoginPasswordDialog email={application.user.email} />
      <div className={compact ? "creator-card-body" : undefined}>
    <p className="registration-required-note">{t("portal.validation.requiredNote")}</p>
    <fieldset className="form-section" aria-label={t("portal.profile.title")} disabled={compact ? saving || savingProfile : disabled} onKeyDown={event => {
      if (canSaveProfileSeparately && event.key === "Enter" && event.target instanceof HTMLInputElement && !event.nativeEvent.isComposing) {
        event.preventDefault();
        if (!saving && !savingProfile) void saveProfile();
      }
    }}>
      <div className="workspace-form-grid">
        {profileField("creditName", t("portal.profile.creditName"))}{profileField("bilibiliUid", t("portal.profile.bilibili"))}{profileField("contactEmail", t("portal.profile.contactEmail"), "email")}
        <Field label={t("portal.profile.contactChannel")} requirement="必选" error={fieldErrors["profile.primaryContactChannel"]}><select name="profile.primaryContactChannel" required form="creator-registration-form" className="field-input" disabled={compact ? saving || savingProfile : disabled} value={form.profile.primaryContactChannel} onChange={event => setForm(current => ({ ...current, profile: { ...current.profile, primaryContactChannel: event.target.value } }))}>{!portalContactChannels.includes(form.profile.primaryContactChannel) ? <option value={form.profile.primaryContactChannel}>{form.profile.primaryContactChannel}</option> : null}{portalContactChannels.map(channel => <option key={channel} value={channel}>{channel === "Email" ? t("portal.profile.email") : systemLabel(channel)}</option>)}</select></Field>{profileField("primaryContactHandle", t("portal.profile.contactAccount"))}
        {profileField("backupContact", t("portal.profile.backup"))}
      </div>
      <label className="checkbox-field"><input name="profile.isAnonymous" form="creator-registration-form" type="checkbox" checked={form.profile.isAnonymous} onChange={event => setForm(current => ({ ...current, profile: { ...current.profile, isAnonymous: event.target.checked } }))} />{t("portal.profile.anonymous")}</label>
      <p className="field-hint">{t("portal.profile.anonymousDetail")}</p>
    </fieldset>
    {canSaveProfileSeparately ? <><Button appearance="industrial" type="button" variant="secondary" disabled={saving || savingProfile} aria-busy={savingProfile} onClick={() => void saveProfile()}>{savingProfile ? t("portal.common.saving") : t("portal.profile.saveCredit")}</Button></> : null}
    {profileMessage ? <ArchiveResult compact={compact} message={profileMessage} /> : null}
      </div>
    </ArchiveChapter>
    <ArchiveChapter enabled={compact} id="plan" number="02" title={t("portal.registration.intent")} state={application.application ? systemLabel(applicationInterestFormatLabels[application.application.interestFormat]) : undefined} defaultOpen={!application.application || application.application.status === "rejected" || application.application.status === "withdrawn"}>

      <div className={compact ? "creator-card-body" : undefined}>
    {!intentEditable ? <Notice>{t("portal.registration.windowClosed", { windowLabel: getApplicationWindowLabel(application.window, language) })}</Notice> : null}
    <fieldset className="form-section" aria-label={t("portal.registration.intent")} disabled={intentDisabled}>
      <div className="workspace-form-grid">
        <Field label={t("portal.registration.expectedType")} requirement="必选" error={fieldErrors["application.interestFormat"]}><select name="application.interestFormat" required form="creator-registration-form" className="field-input" value={form.application.interestFormat} onChange={event => setForm(current => ({ ...current, application: { ...current.application, interestFormat: event.target.value as WorkspaceApplicationInput["application"]["interestFormat"] } }))}>{Object.entries(applicationInterestFormatLabels).map(([value, label]) => <option key={value} value={value}>{systemLabel(label)}</option>)}</select></Field>
      </div>
      <Field label={t("portal.registration.intent")} requirement="必填" error={fieldErrors["application.introText"]}><textarea name="application.introText" form="creator-registration-form" className="field-input" rows={3} required maxLength={1600} placeholder={t("portal.registration.intentPlaceholder")} value={form.application.introText ?? ""} onChange={event => setForm(current => ({ ...current, application: { ...current.application, introText: event.target.value } }))} /></Field>
    </fieldset>
    {editable || selectionUnavailable ? <section className="registration-time-summary" aria-label={t("portal.schedule.registrationTime")}>
      {editable ? <Field label={t("portal.schedule.releaseTime")} requirement="选填" error={fieldErrors.segmentId}>
        <select name="segmentId" form="creator-registration-form" className="field-input" disabled={disabled || assignmentFrozen}
          value={form.segmentId} onChange={event => setForm(current => ({ ...current, segmentId: event.target.value }))}>
          <option value="">{t("portal.schedule.hostArranged")}</option>
          {selectionUnavailable ? <option value={form.segmentId} disabled>{selectedSegment ? t("portal.schedule.noLongerSelectable", { time: formatScheduledTime(selectedSegment.scheduledAt, language) }) : t("portal.schedule.previousUnavailable")}</option> : null}
          {selectableSegments.map(item => <option key={item.id} value={item.id}>
            {item.scheduledAt ? formatScheduledTime(item.scheduledAt, language) : localizeSegmentName(item.code, item.name, language)}{item.status === "reserved" ? t("portal.schedule.reservedForYou") : ""}
          </option>)}
        </select>
        {selectableSegments.length === 0 ? <p className="field-hint">{t("portal.schedule.noTimesRegistration")}</p> : null}
      </Field> : null}
      {selectionUnavailable ? <Notice tone="warning">{t("portal.schedule.unavailableSelection")}</Notice> : null}
    </section> : null}
    {!unifiedPendingSave ? submitControls : null}
      </div>
    </ArchiveChapter>
    {unifiedPendingSave ? submitControls : null}
    {message ? <ArchiveResult compact={compact} message={message} /> : null}
    {refreshWarning ? <ArchiveResult compact={compact} tone="warning" message={refreshWarning} /> : null}
    {error ? <ArchiveResult compact={compact} tone="error" message={error} /> : null}
  </div>;
}
