import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { authClient } from "../../portal/lib/auth-client";
import { useApplicationIntake } from "../lib/use-application-intake";
import { getApplicationWindowLabel } from "../../shared/windows";
import "./apply.css";

const steps = [
  { title: "注册或登录账号", body: "首次参与请先阅读并同意活动规则，再用邮箱注册。注册后会进入接力时间表；如果注册前已经选好了时点，会直接进入工作台。已有账号可切换到登录，继续查看报名和作品资料。" },
  { title: "选择意向发布时间", body: "在时间表选择一个空闲时点，点击“选择这个时点并填写报名”，进入工作台。意向时间只保存在当前浏览器标签页，提交报名成功后才会预留，其他人此时仍可选择同一个时点。" },
  { title: "填写资料并提交报名", body: "填写署名、B站主页链接或数字 UID、联系方式，并选择参加形式。B站账号供相邻作者联系，不会展示在公开作品页。创作简介、作品或主页链接、给主催的话目前均为选填。时间会自动带入，也可以用下拉框改选可用时点。检查资料后，点击“提交报名并预留发布时点”。" },
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
    : isOpen ? "报名已开放。注册后先选意向发布时间，再到工作台填写资料并提交报名。"
    : intake.payload.window?.state === "ended" ? "本轮报名已结束。已报名的创作者可继续登录，查看审核进度与后续安排。"
    : "你可以先注册账号、查看时间表，等报名开放后再提交资料和发布时间。";
  const entryLabel = session ? "前往我的工作台" : isOpen ? "注册并开始报名" : "注册创作者账号";

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
          <p className="participation-action-note">{session ? "查看报名进度、维护资料或处理发布安排。" : "首次参与请先注册；已有账号可在账号页切换登录。"}</p>
          <Link className="participation-rules-link" to="/rules">阅读完整活动规则 <ArrowUpRight size={14} /></Link>
        </section>
        <section className="participation-section" aria-labelledby="participation-steps-title">
          <div className="participation-section-heading"><span aria-hidden="true">01</span><h2 id="participation-steps-title">选择时间，再填写报名资料</h2></div>
          <p className="participation-section-lead">逐星巡礼是以秘封组为主题的同人创作接力。报名在创作者工作台内完成，按下面的顺序准备即可。</p>
          <ol className="participation-steps">
            {steps.map((step, index) => <li key={step.title}>
              <span className="participation-step-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <div><h3>{step.title}</h3><p>{step.body}</p></div>
            </li>)}
          </ol>
        </section>
        <section className="participation-section" aria-labelledby="participation-next-title">
          <div className="participation-section-heading"><span aria-hidden="true">02</span><h2 id="participation-next-title">提交后，查看审核和发布安排</h2></div>
          <p className="participation-section-lead">工作台显示“待审核”，才表示报名已提交、时点已预留。主催审核通过后，报名状态变为“已报名”，时点正式确认。</p>
          <dl className="participation-followup">
            <div><dt>等待报名审核</dt><dd>在工作台查看主催反馈。报名可修改期间，你可以更新资料或改选时点，再次提交后才会生效；审核未通过或撤回报名后，预留时点会释放。</dd></div>
            <div><dt>补充作品资料</dt><dd>报名审核通过后，在工作台填写作品预告和审查说明，按开放安排分别提交，根据主催反馈完善。需要调整发布时间时，可在变更开放期间查看时间表、调整或申请换期。</dd></div>
            <div><dt>发布并确认作品</dt><dd>由作者按约定时刻发布作品，并在当天（北京时间）回到工作台填写作品链接、点击“确认已发布”。作者确认发布且资料审核通过后，作品详情会在站内公开。首次确认只在约定当天开放，确认后仍可修改链接；错过当天请联系主催协调。</dd></div>
          </dl>
        </section>
        <section className="participation-section" aria-labelledby="participation-before-title">
          <div className="participation-section-heading"><span aria-hidden="true">03</span><h2 id="participation-before-title">提交前，再确认两件事</h2></div>
          <div className="participation-reminders">
            <div><h3>公开署名与联系方式分开</h3><p>不公开署名仍需提供有效联系方式，供主催联系与审核。请确认邮箱和主联系渠道能够找到你。</p></div>
            <div><h3>保存个人信息后还需要提交报名</h3><p>“仅保存个人信息”只保存署名和联系方式，不会提交报名或预留时点。请继续检查参加形式和发布时间，完成报名提交，并确认工作台显示“待审核”。</p></div>
          </div>
        </section>
        <div className="participation-closing">
          <Link to={session ? "/portal" : "/portal/login"}>{entryLabel}<ArrowUpRight size={16} /></Link>
        </div>
      </div>
    </div>
  );
}
