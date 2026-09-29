import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { StarChart } from "../components/StarChart";
import { ScrollReveal } from "../components/ScrollReveal";
import { StatusBadge } from "../components/ui";
import { useApplicationIntake } from "../lib/use-application-intake";

export function HomePage() {
  const intake = useApplicationIntake();
  const isOpen = intake.status === "ready" && intake.payload.isOpen;
  return (
    <>
      <section className="home-hero">
        <p className="hero-number">VOL. 2026 / HIFUU CLUB</p>
        <div className="hero-copy">
          <p className="eyebrow">A CREATIVE RELAY BEYOND THE BOUNDARY</p>
          <h1>
            沿着星光，
            <br />
            把故事<em>传下去。</em>
          </h1>
          <p>
            一次关于秘封的共同观测。
            <br />
            以文字、画面与想象接续彼此，
            <br />
            在日常与不可思议之间，留下我们的记录。
          </p>
          <div className="hero-actions">
            <Link className="button button--primary" to="/apply">
              了解创作接力 <ArrowRight size={16} />
            </Link>
            <Link className="button button--secondary" to="/portal/login">
              进入创作者空间
            </Link>
          </div>
        </div>
        <figure className="hero-chart">
          <StarChart />
          <figcaption>RENKO × MERRY · A SHARED OBSERVATION</figcaption>
        </figure>
      </section>
      <ScrollReveal className="home-reveal-block">
      <section className="intake-strip" aria-label="当前报名状态">
        <div>
          <span className="eyebrow">ACTIVITY STATUS</span>
          <StatusBadge tone={isOpen ? "success" : "muted"}>
            {intake.status === "loading"
              ? "正在读取活动状态"
              : intake.status === "error"
                ? "暂时无法读取状态"
                : isOpen
                  ? "报名开放中"
                  : "报名暂未开放"}
          </StatusBadge>
          <p>
            {intake.status === "ready"
              ? (intake.payload.window?.label ?? "秘封组创作接力")
              : intake.status === "error"
                ? intake.message
                : ""}
          </p>
        </div>
        <Link to="/apply" className="text-link">
          查看参与指南 <ArrowUpRight size={15} />
        </Link>
      </section>
      </ScrollReveal>
      <ScrollReveal className="home-reveal-block" delay={80}>
      <section className="editorial-section">
        <div>
          <p className="eyebrow">01 / ABOUT THE RELAY</p>
          <h2>
            不同的创作，
            <br />
            同一条星轨。
          </h2>
        </div>
        <div>
          <p className="editorial-intro">
            STARWARD
            是一场秘封组同人创作接力。无论你想写下一段故事，还是描绘一个瞬间，都可以在这里准备作品、参与报名，与其他创作者共同完成这次接力。
          </p>
          <div className="journey">
            <ScrollReveal delay={0}><article>
              <span>01</span>
              <h3>留下你的名字</h3>
              <p>建立账号，补充联系资料，告诉我们你想带来的创作。</p>
            </article></ScrollReveal>
            <ScrollReveal delay={90}><article>
              <span>02</span>
              <h3>准备你的故事</h3>
              <p>整理预告与作品说明，跟进审核反馈，让想法逐渐成形。</p>
            </article></ScrollReveal>
            <ScrollReveal delay={180}><article>
              <span>03</span>
              <h3>接续下一束光</h3>
              <p>审核通过后，在开放窗口中认领时间段，继续完成接力。</p>
            </article></ScrollReveal>
          </div>
        </div>
      </section>
      </ScrollReveal>
    </>
  );
}
