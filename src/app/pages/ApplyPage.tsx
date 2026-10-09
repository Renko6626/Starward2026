import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { authClient } from "../../portal/lib/auth-client";
import { useApplicationIntake } from "../lib/use-application-intake";
import { getApplicationWindowLabel } from "../../shared/windows";
import "./apply.css";

const steps = [
  { title: "建立创作者账号", body: "使用邮箱注册，已有账号可以直接登录。新注册后会进入接力时间表，已有账号登录后进入工作台。" },
  { title: "选择意向发布时间", body: "在时间表选择一个空闲时点，再进入工作台填写报名资料。意向时间保存在当前浏览器标签页，提交报名成功后才会预留。如果注册前已经选好了时点，会直接进入工作台。" },
  { title: "填写资料并提交报名", body: "报名需要准备一个 B站账号，填写主页链接或数字 UID，供相邻作者联系，不会展示在公开作品页。填写署名、联系方式和创作计划；作品或主页链接为选填。时间会自动带入，也可以通过下拉框改选可用时点。确认后提交报名，在工作台查看审核结果。" },
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
    : isOpen ? "现在可以建立账号、完善资料并提交创作计划。"
    : intake.payload.window?.state === "ended" ? "本轮报名已结束。已报名的创作者可继续登录，查看审核进度与后续安排。"
    : "你可以先建立账号，等待报名窗口开放后一起填写联系资料、创作计划和发布时段。";

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
            {session ? "前往我的报名" : "进入创作者工作台"}<ArrowUpRight size={18} />
          </Link>
          <p className="participation-action-note">{session ? "继续查看或维护当前账号的报名资料。" : "已有账号可直接登录，首次参与请先注册。"}</p>
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
          <div className="participation-section-heading"><span aria-hidden="true">02</span><h2 id="participation-next-title">审核通过后，安排你的发布</h2></div>
          <p className="participation-section-lead">创作计划与发布时段一起提交。提交报名时一并选择发布时段，时段会先为你预留。主催审核通过后，正式确认占坑。</p>
          <dl className="participation-followup">
            <div><dt>认领发布时段</dt><dd>报名时选择空闲时段，提交成功后预留；审核未通过或撤回报名后释放。通过后可在调整窗口内换期。</dd></div>
            <div><dt>补充作品资料</dt><dd>按开放安排提交预告资料与审查说明，根据反馈完善内容。</dd></div>
            <div><dt>按日程发布作品</dt><dd>由作者在约定的时段发布作品，并在当天回到工作台填写作品链接、确认已发布。作者确认发布且资料审核通过后，作品详情会在站内公开，链接之后仍可修改。</dd></div>
          </dl>
        </section>
        <section className="participation-section" aria-labelledby="participation-before-title">
          <div className="participation-section-heading"><span aria-hidden="true">03</span><h2 id="participation-before-title">提交前，再确认两件事</h2></div>
          <div className="participation-reminders">
            <div><h3>公开署名与联系方式分开</h3><p>不公开署名仍需提供有效联系方式，供主催联系与审核。请确认邮箱和主联系渠道能够找到你。</p></div>
            <div><h3>沿用同一个创作者账号</h3><p>已有账号请直接登录。报名资料、审核反馈和后续日程都关联这个账号，方便你持续查看和更新。</p></div>
          </div>
        </section>
        <div className="participation-closing">
          <Link to={session ? "/portal" : "/portal/login"}>{session ? "前往我的报名" : "进入创作者工作台"}<ArrowUpRight size={16} /></Link>
        </div>
      </div>
    </div>
  );
}
