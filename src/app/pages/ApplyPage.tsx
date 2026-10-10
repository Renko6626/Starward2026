import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { authClient } from "../../portal/lib/auth-client";
import { useApplicationIntake } from "../lib/use-application-intake";
import { getApplicationWindowLabel } from "../../shared/windows";
import "./apply.css";

const steps = [
  { title: "注册或登录", body: "阅读并同意活动规则后，用邮箱注册。已有账号直接登录。" },
  { title: "拟定时间段", body: "在时间表选空闲时段。报名通过后，在开放期间可调整或申请换期。" },
  { title: "填写资料和提交", body: "填写基本信息和创作意向，再点击“提交报名并预留发布时点”。审核通过即报名成功。" },
];

export function ApplyPage() {
  const { data: session } = authClient.useSession();
  const intake = useApplicationIntake();
  const isOpen = intake.status === "ready" && intake.payload.isOpen;
  const status = intake.status === "loading" ? "正在读取报名状态"
    : intake.status === "error" ? "暂时无法读取报名状态"
    : getApplicationWindowLabel(intake.payload.window);
  const statusNote = intake.status === "loading" ? "报名状态读取后，会在这里显示当前安排。"
    : intake.status === "error" ? intake.message
    : isOpen ? "作品还没完成，也可以先报名。"
    : intake.payload.window?.state === "ended" ? "已报名的作者可登录作者页面查看进度。"
    : "可以先注册、看时间表，报名开放后再提交。";
  const entryLabel = session ? "进入作者页面" : isOpen ? "开始报名" : "先注册账号";

  return (
    <div className="participation-guide">
      <aside className="participation-aside">
        <div className="participation-aside-copy">
          <Link to="/" className="participation-back"><ArrowLeft size={14} /> 返回首页</Link>
          <p className="participation-kicker">STARWARD PILGRIMAGE / 2026</p>
          <h1>参与指南</h1>
        </div>
        <figure className="participation-artwork" aria-hidden="true">
          <img src="/station-drawings/side-elevation.png" alt="" width={1260} height={850} />
          <figcaption><span>TORIFUNE</span><span>EXTERIOR STUDY / 01</span></figcaption>
        </figure>
      </aside>
      <div className="participation-content">
        <section className="participation-status" aria-labelledby="participation-status-title">
          <p className="participation-section-label">当前报名状态</p>
          <div role="status" aria-live="polite">
            <h2 id="participation-status-title"><span className={`participation-status-dot${isOpen ? " is-open" : ""}`} aria-hidden="true" />{status}</h2>
            <p>{statusNote}</p>
          </div>
          <Link to={session ? "/portal" : "/portal/login"} className="participation-action">
            {entryLabel}<ArrowUpRight size={18} />
          </Link>
          <p className="participation-action-note">{session ? "查看报名进度和作品资料。" : "已有账号可直接登录。"}</p>
          <Link className="participation-rules-link" to="/rules">阅读完整活动规则 <ArrowUpRight size={14} /></Link>
        </section>
        <section className="participation-section" aria-labelledby="participation-steps-title">
          <div className="participation-section-heading"><h2 id="participation-steps-title">参与活动流程</h2></div>
          <ol className="participation-steps">
            {steps.map((step, index) => <li key={step.title}>
              <span className="participation-step-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <div><h3>{step.title}</h3><p>{step.body}</p></div>
            </li>)}
          </ol>
          <p className="participation-success-note">看到<strong>“待审核”</strong>，就表示报名已提交、时段已预留。通过后会发送确认邮件，审核状态以作者页面显示为准。</p>
        </section>
        <section className="participation-section" aria-labelledby="participation-next-title">
          <div className="participation-section-heading"><h2 id="participation-next-title">后续事项</h2></div>
          <dl className="participation-followup">
            <div><dt>安心创作</dt><dd>报名通过后，参与资格和时段正式确认。继续创作，请尽量提前完成，避免当DDL战神。</dd></div>
            <div><dt>完成并提交</dt><dd><strong>11 月 11 日 23:00 前（北京时间）</strong>完成作品、补齐资料并提交。作品内容提交方式日后开放。</dd></div>
            <div><dt>发布和确认</dt><dd>按约定时刻在B站平台发布，发布成功后回作者页面填写作品链接，并点击“确认已发布”（我们会帮忙进行确认，有问题会通知，请尽量保持联系畅通）。</dd></div>
          </dl>
        </section>
        <div className="participation-closing">
          <Link to={session ? "/portal" : "/portal/login"}>{entryLabel}<ArrowUpRight size={16} /></Link>
        </div>
      </div>
    </div>
  );
}
