import { Link } from "@tanstack/react-router";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";

export function ApplySuccessPage() {
  return (
    <div className="page-stack">
      <div className="page-heading">
        <StatusBadge label="已提交" tone="success" />
        <h1>报名已送达</h1>
        <p>你的报名已进入后台审核队列。通过后，主催会把该邮箱加入参与者门户入口名单。</p>
      </div>

      <SectionCard
        eyebrow="后续步骤"
        title="接下来会发生什么"
        description="第一期把公开报名和后台审核拆开，是为了让主催能明确地把参与者转入正式协作流程。"
      >
        <ul className="plain-list">
          <li>后台会先查看报名信息并做批准 / 拒绝处理。</li>
          <li>通过后，该邮箱会成为受控登录邮箱。</li>
          <li>真正的时间段认领、变更和资料补录会在参与者门户完成。</li>
        </ul>
        <div className="action-row">
          <Link className="button button--primary" to="/">
            返回开始页
          </Link>
          <Link className="button button--secondary" to="/portal/login">
            参与者登录
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
