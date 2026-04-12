import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "../components/icons";
import { authClient } from "../../portal/lib/auth-client";
import { requestJson } from "../lib/api";
import type { ApplicationIntakeResponse } from "../../shared/applications";

type IntakeState =
  | { status: "loading" }
  | { status: "ready"; payload: ApplicationIntakeResponse }
  | { status: "error"; message: string };

export function ApplyPage() {
  const sessionQuery = authClient.useSession();
  const [intake, setIntake] = useState<IntakeState>({ status: "loading" });

  useEffect(() => {
    void requestJson<ApplicationIntakeResponse>("/api/applications/intake")
      .then((payload) => setIntake({ status: "ready", payload }))
      .catch((error: Error) =>
        setIntake({
          status: "error",
          message: error.message || "无法读取当前报名状态。",
        }),
      );
  }, []);

  const loggedIn = Boolean(sessionQuery.data);
  const applicationOpen = intake.status === "ready" ? intake.payload.isOpen : false;
  const ctaTo = loggedIn ? "/portal/application" : "/portal/login";
  const windowLabel = intake.status === "ready" ? intake.payload.window?.label : null;
  const windowText = intake.status === "ready"
    ? intake.payload.isOpen
      ? "当前可以进入参与者入口填写正式报名。"
      : "当前未开放正式报名，开放后仍需先完成参与者登录。"
    : intake.status === "error"
      ? intake.message
      : "正在读取窗口状态...";

  return (
    <div className="max-w-3xl mx-auto space-y-8 relative z-10 py-8">
      <div className="mb-12">
        <Link className="text-sm font-mono text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2 mb-6" to="/">
          <ArrowRight className="w-4 h-4 rotate-180" /> 返回首页
        </Link>
        <h1 className="text-4xl font-headline tracking-tight mb-4">报名须知</h1>
        <p className="text-lg text-on-surface-variant">正式报名已经统一收口到参与者入口内提交。公共页面只负责说明规则、窗口状态与下一步入口。</p>
      </div>

      <div className="space-y-6">
        <div className="p-6 border-l-4 border-tertiary bg-surface-container-low/80 rounded-r-lg">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-5 h-5 text-tertiary" />
            <h2 className="text-lg font-medium">当前窗口：{applicationOpen ? "正式报名开放中" : "报名暂未开放"}</h2>
          </div>
          <p className="text-sm text-on-surface-variant font-mono">
            {windowLabel ?? "报名开放"}
            {windowLabel ? " · " : ""}
            {windowText}
          </p>
        </div>

        <div className="p-8 border border-outline-variant bg-surface-container-low/50 rounded-xl space-y-4">
          <h3 className="text-xl font-headline">报名条件</h3>
          <ul className="space-y-3 text-on-surface-variant list-disc list-inside">
            <li>正式报名必须绑定参与者入口账号。</li>
            <li>匿名仅表示不公开或不填写笔名，不表示匿名账号提交。</li>
            <li>主催识别与联系依赖邮箱、主联系渠道与主联系标识。</li>
            <li>报名窗口是否可提交，由活动窗口设置统一控制。</li>
          </ul>
        </div>

        <div className="pt-6">
          <Link className="w-full block text-center px-6 py-4 bg-primary text-on-primary rounded-xl font-medium hover:bg-primary/90 transition-colors text-lg" to={ctaTo}>
            {loggedIn ? "前往当前账号的报名页" : "我已了解，前往报名登录"}
          </Link>
        </div>
      </div>
    </div>
  );
}
