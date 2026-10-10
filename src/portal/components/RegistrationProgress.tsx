import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
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

export function RegistrationProgress({ application, participantStatus, current, selected, onWithdraw, withdrawing = false, withdrawalConfirmation }: {
  application: PortalApplicationResponse;
  participantStatus?: ParticipantPortalStatus;
  current?: CollaborationSegment;
  selected?: CollaborationSegment;
  onWithdraw?: () => void;
  withdrawing?: boolean;
  withdrawalConfirmation?: ReactNode;
}) {
  const status = application.application?.status;
  const { approved, pending, withdrawn, rejected, label } = getRegistrationProgress(status, participantStatus);
  const completed = participantStatus === "completed";
  const time = current ?? selected;
  const timeStatus = current ? current.status === "confirmed" ? "已确认" : current.status === "reserved" ? "已预留" : "请查看排期状态"
    : selected ? selected.status === "available" ? "尚未预留" : "已不可选，请重新选择" : "尚未选择";
  const next = approved ? completed ? "可查看作品和操作记录。" : current ? "作品完成后，再填写并提交作品资料。" : "先选择发布时间，再继续创作。"
    : pending ? application.editable ? "等待主催审核，期间可修改或撤回报名。" : "等待主催审核，当前仍可撤回报名。"
    : application.editable ? withdrawn ? "重新选择发布时间，检查资料后再次提交报名。" : rejected ? "根据主催反馈修改资料后，重新提交报名。" : "填写署名与联系、创作意向，选择时间后提交报名。"
    : "当前不能提交或修改报名，请查看参与指南或联系主催。";

  return <section className="registration-progress" aria-label="报名进度">
    <div className="registration-progress-body">
      <div className="registration-progress-copy"><h2>{label}</h2><p>{next}</p></div>
      <div className="registration-progress-time"><h3>发布时间（北京时间）</h3><p>{time ? formatScheduledTime(time.scheduledAt) : "尚未选择"}</p>{time ? <span>{timeStatus}</span> : null}</div>
    </div>
    <div className="registration-progress-actions">
      {completed ? <a className="button button--secondary" href="#history">查看操作记录</a>
        : approved && current ? <Link className="button button--secondary" to="/works" search={{ q: "", type: "all", view: "gallery" }}>调整发布时间</Link>
        : approved ? <Link className="button button--primary" to="/works" search={{ q: "", type: "all", view: "gallery" }}>选择发布时间</Link>
        : pending ? <><a className="button button--secondary" href="#plan">{application.editable ? "查看或修改报名" : "查看报名资料"}</a><button className="text-link" type="button" disabled={withdrawing} onClick={onWithdraw}>撤回报名</button></>
        : application.editable ? <a className="button button--primary" href="#plan">{withdrawn || rejected ? "修改资料并重新报名" : "填写报名资料"}</a>
        : <Link className="button button--secondary" to="/apply">查看参与指南</Link>}
    </div>
    {pending ? withdrawalConfirmation : null}
  </section>;
}
