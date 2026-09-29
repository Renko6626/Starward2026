import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { authClient } from "../../portal/lib/auth-client";
import { useApplicationIntake } from "../lib/use-application-intake";
import { Notice, StatusBadge } from "../components/ui";

export function ApplyPage() {
  const { data: session } = authClient.useSession();
  const intake = useApplicationIntake();
  const isOpen = intake.status === "ready" && intake.payload.isOpen;
  return (
    <div className="guide-layout">
      <aside className="guide-aside">
        <p className="eyebrow">PARTICIPATION / 2026</p>
        <h1>
          让故事
          <br />
          从这里开始。
        </h1>
        <p>在进入创作接力之前，花一点时间了解报名方式与后续安排。</p>
        <Link to="/" className="text-link mt-8">
          返回活动首页 <ArrowRight size={15} />
        </Link>
      </aside>
      <div>
        <section className="guide-section">
          <h2>当前报名状态</h2>
          <StatusBadge tone={isOpen ? "success" : "muted"}>
            {intake.status === "loading"
              ? "正在读取"
              : intake.status === "error"
                ? "状态读取失败"
                : isOpen
                  ? "正式报名开放中"
                  : "报名暂未开放"}
          </StatusBadge>
          <div className="mt-5">
            <Notice>
              {intake.status === "ready"
                ? isOpen
                  ? "现在可以登录创作者空间，完善资料并提交报名。"
                  : "你可以先建立账号、完善个人档案，等待报名窗口开放。"
                : intake.status === "error"
                  ? intake.message
                  : "正在获取最新报名安排。"}
            </Notice>
          </div>
        </section>
        <section className="guide-section">
          <h2>报名前，请先了解</h2>
          <ul>
            <li>
              报名需要一个创作者账号。后续的审核进度、作品资料和接力日程，都可以在同一个空间查看。
            </li>
            <li>
              可以选择不公开署名。主催仍需要有效的邮箱和联系方式，以便与你沟通。
            </li>
            <li>
              提交报名后，由主催审核参与资格。时间段认领等操作在审核通过及对应窗口开放后进行。
            </li>
            <li>已有账号请直接登录，继续维护原有资料。</li>
          </ul>
        </section>
        <section className="guide-section">
          <h2>接下来，只需三步</h2>
          <div className="guide-steps">
            <div>
              <span>01</span>
              <div>
                <h3>建立账号</h3>
                <p>使用邮箱和密码注册，已有账号可以直接登录。</p>
              </div>
            </div>
            <div>
              <span>02</span>
              <div>
                <h3>完善个人档案</h3>
                <p>填写联系方式，并选择你希望对外展示的署名方式。</p>
              </div>
            </div>
            <div>
              <span>03</span>
              <div>
                <h3>提交创作意向</h3>
                <p>
                  在报名页填写参加形式、创作简介与作品链接，提交后等待审核。
                </p>
              </div>
            </div>
          </div>
        </section>
        <div className="pt-8">
          <Link
            className="button button--primary w-full"
            to={session ? "/portal/application" : "/portal/login"}
          >
            {session ? "前往我的报名" : "进入创作者空间"}
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
