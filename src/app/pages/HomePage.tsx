import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";

type HealthState =
  | { status: "loading" }
  | { status: "ready"; service: string }
  | { status: "error" };

export function HomePage() {
  const [health, setHealth] = useState<HealthState>({ status: "loading" });

  useEffect(() => {
    let mounted = true;

    void fetch("/api/health")
      .then((response) => response.json() as Promise<{ service: string }>)
      .then((data) => {
        if (mounted) {
          setHealth({ status: "ready", service: data.service });
        }
      })
      .catch(() => {
        if (mounted) {
          setHealth({ status: "error" });
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div className="hero-panel__copy">
          <StatusBadge label="筹备中" tone="warn" />
          <h1>观测准备中，活动入口已搭建。</h1>
          <p>
            第一期先上线主催运营面、参与者门户，以及一个能表达当前阶段的公共开始页。
            最终作品归档页会在活动后段补齐。
          </p>
          <div className="hero-panel__actions">
            <Link className="button button--primary" to="/apply">
              报名与须知
            </Link>
            <Link className="button button--secondary" to="/portal/login">
              参与者登录
            </Link>
            <Link className="button button--secondary" to="/admin">
              进入后台壳
            </Link>
          </div>
        </div>
        <dl className="hero-panel__meta">
          <div>
            <dt>当前阶段</dt>
            <dd>筹备与系统搭建</dd>
          </div>
          <div>
            <dt>报名状态</dt>
            <dd>尚未开放</dd>
          </div>
          <div>
            <dt>归档状态</dt>
            <dd>公开前封存中</dd>
          </div>
          <div>
            <dt>Worker 状态</dt>
            <dd>
              {health.status === "loading" ? "检查中" : null}
              {health.status === "ready" ? `${health.service} 已响应` : null}
              {health.status === "error" ? "尚未确认" : null}
            </dd>
          </div>
        </dl>
      </section>

      <div className="grid-two">
        <SectionCard
          accent="blue"
          eyebrow="公共入口"
          title="第一期先回答 3 个问题"
          description="活动是什么、现在到哪一步、参与者和主催从哪里进入。"
        >
          <ul className="plain-list">
            <li>这是什么活动：秘封题材同人接力创作站。</li>
            <li>现在进行到哪一步：筹备中，门户与后台优先落地。</li>
            <li>从哪里进入：参与者走 `/portal/login`，主催走 `/admin`。</li>
          </ul>
        </SectionCard>

        <SectionCard
          accent="amber"
          eyebrow="阶段说明"
          title="为什么不是空白施工页"
          description="第一期是运营启动版，不是开发者临时占位页。"
        >
          <ul className="plain-list">
            <li>页面需要表达当前阶段，而不是只写一行 Coming Soon。</li>
            <li>招募若未开放，就明确写未开放，并保留主催联系路径。</li>
            <li>作品归档页不是当前重点，先把审核和门户状态流做通。</li>
          </ul>
        </SectionCard>
      </div>

      <SectionCard
        eyebrow="当前结构"
        title="第一期页面壳已对准实施稿"
        description="下一步将继续把后台审核、登录、时间段和资料补录逐个做实。"
      >
        <div className="route-grid">
          <div>
            <h3>公共</h3>
            <ul className="plain-list">
              <li>`/` 开始页</li>
              <li>`/apply` 报名页</li>
              <li>`/apply/success` 提交成功说明页</li>
            </ul>
          </div>
          <div>
            <h3>后台</h3>
            <ul className="plain-list">
              <li>`/admin`</li>
              <li>`/admin/applications`</li>
              <li>`/admin/participants`</li>
              <li>`/admin/schedule` 时间段状态</li>
              <li>`/admin/settings/windows` 动作窗口</li>
            </ul>
          </div>
          <div>
            <h3>参与者</h3>
            <ul className="plain-list">
              <li>`/portal/login`</li>
              <li>`/portal`</li>
              <li>`/portal/schedule` 我的时间段</li>
              <li>`/portal/project`</li>
            </ul>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
