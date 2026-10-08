import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { ApplicationStatus } from "../../shared/applications";
import { Notice } from "../../app/components/ui";
import { formatScheduledTime } from "../../app/lib/format";
import type { CollaborationSegment } from "../../shared/collaboration";
import type { ParticipantPortalStatus, PortalApplicationResponse } from "../../shared/portal";

export function getRegistrationProgress(status: ApplicationStatus | undefined, participantStatus?: ParticipantPortalStatus) {
  const approved = participantStatus === "approved" || participantStatus === "completed";
  const pending = !approved && status === "pending";
  const rejected = !approved && status === "rejected";
  const withdrawn = !approved && (status === "withdrawn" || (!status && participantStatus === "withdrawn"));
  const label = approved ? "已报名" : pending ? "待审核" : rejected ? "审核未通过" : withdrawn ? "已撤回" : "未报名";
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
  const { approved, pending, withdrawn, rejected, label, step } = getRegistrationProgress(status, participantStatus);
  const completed = participantStatus === "completed";
  const time = current ?? selected;
  const timeStatus = current ? current.status === "confirmed" ? "已确认" : current.status === "reserved" ? "已预留" : "请查看排期状态"
    : selected ? selected.status === "available" ? "尚未预留" : "已不可选，请重新选择" : "尚未选择";
  const explanation = approved ? completed ? "你已完成本次参与，可以回顾作品和参与记录。" : "报名审核已通过，可以继续准备作品资料。"
    : pending ? "报名已提交，正在等待主催审核。"
    : withdrawn ? "报名已撤回，原先预留的发布时点已释放。"
    : rejected ? "本次报名未通过审核，请查看主催意见。"
    : "你还没有提交报名。选中时间后，需要填写资料并提交，才会预留时点。";
  const next = approved ? completed ? "查看作品和参与记录。" : current ? "填写作品预告和审查说明。" : "先认领发布时点，再填写作品资料。"
    : pending ? application.editable ? "等待审核；需要修改时可更新报名，或撤回报名。" : "等待审核；当前不能修改报名，仍可撤回。"
    : application.editable ? withdrawn ? "重新选择发布时间，检查资料后再次提交报名。" : rejected ? "根据主催意见修改资料后，重新提交报名。" : "完善个人信息和创作计划，确认时间后提交报名。"
    : "当前报名修改窗口未开放，请查看参与指南或联系主催。";

  return <section className="registration-progress" aria-label="报名进度">
    <ol className="registration-progress-steps" aria-label="报名阶段">
      {["未报名", "待审核", "已报名"].map((name, index) => <li key={name} className={index < step ? "is-complete" : index === step && !withdrawn && !rejected ? "is-current" : undefined} aria-current={index === step && !withdrawn && !rejected ? "step" : undefined}><span aria-hidden="true">{index + 1}</span>{name}</li>)}
    </ol>
    <div className="registration-progress-body">
      <div className="registration-progress-copy"><h2>{label}</h2><p>{explanation}</p><p className="registration-progress-next">下一步：{next}</p></div>
      <div className="registration-progress-time"><h3>发布时间</h3><p>{time ? formatScheduledTime(time.scheduledAt) : "尚未选择发布时间"}</p><span>{timeStatus}</span></div>
    </div>
    {pending && application.editable ? <Notice>修改后仍是同一份待审核报名，主催会看到最新提交的内容。更换发布时间需再次提交，成功后才会释放原时点并预留新时点。</Notice> : null}
    {application.application?.adminNote ? <Notice tone="warning">主催意见：{application.application.adminNote}</Notice> : null}
    <div className="registration-progress-actions">
      {completed ? <a className="button button--secondary" href="#history">查看操作记录</a>
        : approved && current ? <><a className="button button--primary" href="#project">填写作品资料</a><Link className="button button--secondary" to="/works" search={{ q: "", type: "all", view: "gallery" }}>调整时间或申请换期</Link></>
        : approved ? <Link className="button button--primary" to="/works" search={{ q: "", type: "all", view: "gallery" }}>选择发布时间</Link>
        : pending ? <><a className="button button--secondary" href="#plan">{application.editable ? "查看或修改报名" : "查看报名资料"}</a><button className="text-link" type="button" disabled={withdrawing} onClick={onWithdraw}>撤回报名</button></>
        : application.editable ? <a className="button button--primary" href="#plan">{withdrawn || rejected ? "修改资料并重新报名" : "填写报名资料"}</a>
        : <Link className="button button--secondary" to="/apply">查看参与指南</Link>}
    </div>
    {pending ? withdrawalConfirmation : null}
  </section>;
}
