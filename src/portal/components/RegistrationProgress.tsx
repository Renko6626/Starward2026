import { useSiteTranslation } from "../../i18n/use-site-translation";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import type { ApplicationStatus } from "../../shared/applications";
import { formatScheduledTime } from "../../app/lib/format";
import type { CollaborationSegment } from "../../shared/collaboration";
import type { ParticipantPortalStatus, PortalApplicationResponse } from "../../shared/portal";

export function getRegistrationProgress(status: ApplicationStatus | undefined, participantStatus?: ParticipantPortalStatus) {
  const approved = participantStatus === "approved" || participantStatus === "completed";
  const pending = !approved && status === "pending";
  const rejected = !approved && status === "rejected";
  const withdrawn = !approved && (status === "withdrawn" || (!status && participantStatus === "withdrawn"));
  const label = approved ? participantStatus === "completed" ? "参与已完成" : "报名已通过" : pending ? "报名待审核" : rejected ? "审核未通过" : withdrawn ? "已撤回" : "未报名";
  return { approved, pending, rejected, withdrawn, label, step: approved ? 2 : pending ? 1 : 0 };
}

export function RegistrationProgress({ application, participantStatus, current, onWithdraw, withdrawing = false, withdrawalConfirmation, focusAfterSubmit = false }: {
  application: PortalApplicationResponse;
  participantStatus?: ParticipantPortalStatus;
  current?: CollaborationSegment;
  onWithdraw?: () => void;
  withdrawing?: boolean;
  withdrawalConfirmation?: ReactNode;
  focusAfterSubmit?: boolean;
}) {
  const { t, language, label: systemLabel } = useSiteTranslation();
  const region = useRef<HTMLElement>(null);
  const focusedAfterSubmit = useRef(false);
  useEffect(() => {
    if (!focusAfterSubmit || focusedAfterSubmit.current) return;
    focusedAfterSubmit.current = true;
    region.current?.focus({ preventScroll: true });
    region.current?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }, [focusAfterSubmit]);
  const status = application.application?.status;
  const { approved, pending, withdrawn, rejected, label } = getRegistrationProgress(status, participantStatus);
  const completed = participantStatus === "completed";
  const time = current;
  const frozen = current?.assignmentStatus === "locked" || current?.assignmentStatus === "completed";
  const timeStatus = current?.assignmentStatus === "locked" ? t("portal.schedule.lockedHint") : current?.assignmentStatus === "completed" ? t("portal.schedule.completed") : current ? current.status === "confirmed" ? t("portal.schedule.confirmed") : current.status === "reserved" ? t("portal.schedule.reserved") : t("portal.schedule.checkStatus")
    : t("portal.schedule.hostArranged");
  const next = approved ? completed ? t("portal.registration.completedNext") : current ? t("portal.registration.approvedNext") : t("portal.registration.approvedUnassigned")
    : pending ? t("portal.registration.pendingNext")
    : application.editable ? withdrawn ? t("portal.registration.withdrawnNext") : rejected ? t("portal.registration.rejectedNext") : t("portal.registration.newNext")
    : t("portal.registration.closedNext");

  return <section ref={region} tabIndex={-1} className="registration-progress" aria-label={t("portal.registration.progress")}>
    <dl className="archive-register">
      <div><dt>{t("portal.profile.author")}</dt><dd>{application.profile?.creditName || application.user.name || t("portal.profile.creditMissing")}</dd></div>
      <div><dt>{t("portal.schedule.releaseBeijing")}</dt><dd>{time ? formatScheduledTime(time.scheduledAt, language) : t("portal.schedule.hostArranged")}<small>{time ? timeStatus : null}</small></dd></div>
      <div><dt>{t("portal.schedule.kind")}</dt><dd>{current?.kind === "special" ? t("portal.schedule.special") : current?.kind === "extra" ? t("portal.schedule.extra") : current ? t("portal.schedule.regular") : t("portal.schedule.unassigned")}</dd></div>
      <div><dt>{t("portal.schedule.code")}</dt><dd>{time?.code || "—"}</dd></div>
      <div><dt>{t("portal.registration.label")}</dt><dd>{systemLabel(label)}</dd></div>
    </dl>
    <div className="registration-progress-body">
      <div className="registration-progress-copy"><h2>{systemLabel(label)}</h2><p>{next}</p></div>
      <div className="registration-progress-time"><h3>{t("portal.schedule.releaseTime")}</h3><p>{time ? formatScheduledTime(time.scheduledAt, language) : t("portal.schedule.hostArranged")}</p>{time ? <span>{timeStatus}</span> : null}</div>
    </div>
    <div className="registration-progress-actions">
      {completed ? <a className="button button--secondary" href="#history">{t("portal.history.view")}</a>
        : approved ? <Link className="button button--secondary" to="/portal" hash="relay">{t("portal.schedule.viewRelay")}</Link>
        : pending ? <><a className="button button--secondary" href="#plan">{application.editable ? t("portal.registration.viewEdit") : t("portal.registration.view")}</a>{!frozen ? <button className="text-link" type="button" disabled={withdrawing} onClick={onWithdraw}>{t("portal.registration.withdraw")}</button> : null}</>
        : application.editable ? <a className="button button--primary" href={withdrawn || rejected ? "#plan" : "#profile"}>{withdrawn || rejected ? t("portal.registration.editResubmit") : t("portal.registration.fill")}</a>
        : <Link className="button button--secondary" to="/apply">{t("portal.registration.guide")}</Link>}
    </div>
    {pending ? withdrawalConfirmation : null}
  </section>;
}
