import { Link } from "@tanstack/react-router";
import { SectionCard } from "../../app/components/SectionCard";
import { StatusBadge } from "../../app/components/StatusBadge";

export function AdminOverviewPage() {
  return (
    <div className="page-stack">
      <div className="page-heading">
        <StatusBadge label="后台壳" />
        <h1>主催运营工作台</h1>
        <p>这里先放一期真正需要跑通的管理入口，而不是做一个过度产品化的后台首页。</p>
      </div>

      <div className="grid-two">
        <SectionCard
          eyebrow="第一期核心"
          title="需要先验证的运营链路"
          description="审核报名、转入参与者、查看时间段、处理补录资料。"
        >
          <ul className="plain-list">
            <li>先让主催能处理申请，不做复杂报表。</li>
            <li>先让主催能看到参与者和时间段状态，不做作品发布后台。</li>
            <li>后台身份继续按 Cloudflare Access 规划，不自建管理员登录。</li>
          </ul>
        </SectionCard>

        <SectionCard eyebrow="待接入" title="下一步要接的真实数据">
          <ul className="plain-list">
            <li>`applications` 列表与详情</li>
            <li>`participants` 列表与邀请状态</li>
            <li>`schedule_segments` 当前时间段占用情况</li>
            <li>`project_drafts` 预告与审查资料</li>
            <li>`event_windows` 当前动作开关</li>
          </ul>
        </SectionCard>
      </div>

      <div className="route-grid">
        <Link className="route-tile" to="/admin/applications">
          报名列表
        </Link>
        <Link className="route-tile" to="/admin/participants">
          参与者
        </Link>
        <Link className="route-tile" to="/admin/schedule">
          时间段状态
        </Link>
        <Link className="route-tile" to="/admin/project-drafts">
          资料审阅
        </Link>
        <Link className="route-tile" to="/admin/settings/windows">
          动作窗口
        </Link>
      </div>
    </div>
  );
}
