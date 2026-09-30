import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { StarChart } from "../components/StarChart";
import { ScrollReveal } from "../components/ScrollReveal";
import { StatusBadge } from "../components/ui";
import { useApplicationIntake } from "../lib/use-application-intake";
import { getApplicationWindowLabel } from "../../shared/windows";

export function HomePage() {
  const intake = useApplicationIntake();
  const isOpen = intake.status === "ready" && intake.payload.isOpen;
  return (
    <>
      <section className="home-hero">
        <p className="hero-number">VOL. 2026</p>
        <div className="hero-copy">
          <p className="eyebrow">HIFUU / CREATIVE RELAY</p>
          <h1>
            沿着星光，
            <br />
            把故事<em>传下去。</em>
          </h1>
          <p>
            一场秘封组同人创作接力，以文字与画面，接续彼此的想象。
          </p>
          <section className="intake-strip" aria-label="当前报名状态">
            <span className="intake-label">当前报名状态</span>
            <StatusBadge tone={isOpen ? "success" : "muted"}>
              {intake.status === "loading"
                ? "正在读取活动状态"
                : intake.status === "error"
                  ? "暂时无法读取状态"
                  : getApplicationWindowLabel(intake.payload.window)}
            </StatusBadge>
            {intake.status === "error" ? <p>{intake.message}</p> : null}
          </section>
          <div className="hero-actions">
            <Link className="button button--primary" to="/apply">
              查看参与指南 <ArrowRight size={16} />
            </Link>
            <Link className="button button--secondary" to="/portal/login">
              进入创作者空间
            </Link>
          </div>
        </div>
        <figure className="hero-chart">
          <StarChart />
        </figure>
      </section>
      <section className="editorial-section">
        <ScrollReveal>
          <p className="eyebrow">01 / ABOUT THE RELAY</p>
          <h2>
            不同的创作，
            <br />
            同一条星轨。
          </h2>
        </ScrollReveal>
        <div>
          <p className="editorial-intro">
            从故事到画面，让不同的创作在这里相遇。提交报名、准备作品，在开放窗口中认领接力时段。
          </p>
          <div className="journey">
            <ScrollReveal>
              <article>
                <span>01</span>
                <h3>提交报名</h3>
                <p>建立账号，补充联系资料，提交你的创作计划。</p>
              </article>
            </ScrollReveal>
            <ScrollReveal delay={50}>
              <article>
                <span>02</span>
                <h3>准备作品</h3>
                <p>整理预告与作品说明，根据审核反馈完善内容。</p>
              </article>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <article>
                <span>03</span>
                <h3>认领时段</h3>
                <p>审核通过后，在开放窗口中认领时段，按日程完成接力。</p>
              </article>
            </ScrollReveal>
          </div>
        </div>
      </section>
    </>
  );
}
