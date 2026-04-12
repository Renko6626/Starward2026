import { Link } from "@tanstack/react-router";
import { ArrowRight, Palette, Scroll, Stars } from "../components/icons";

export function HomePage() {
  return (
    <div className="max-w-5xl mx-auto space-y-12 relative z-10 py-8">
      <section className="text-center space-y-6 py-12 border-b border-outline-variant relative">
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
          <Stars className="w-96 h-96" />
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-variant border border-outline-variant text-xs font-mono text-tertiary mb-4">
          <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
          第一期：门户与后台运行中
        </div>
        <h1 className="text-5xl md:text-7xl font-headline tracking-tighter text-primary">
          STARWARD <span className="text-on-surface">2026</span>
        </h1>
        <p className="text-xl text-on-surface-variant max-w-2xl mx-auto font-light">
          秘封组同人创作接力活动站。当前阶段先开放开始页、参与者门户，以及主催后台。
        </p>
        <div className="flex items-center justify-center gap-4 pt-4 flex-wrap">
          <Link
            className="px-6 py-3 bg-primary text-on-primary rounded-full font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
            to="/apply"
          >
            报名须知 <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            className="px-6 py-3 bg-surface-variant text-on-surface rounded-full font-medium hover:bg-surface-bright transition-colors border border-outline-variant"
            to="/portal/login"
          >
            创作者后台
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-8 border border-outline-variant bg-surface-container-low/50 rounded-2xl backdrop-blur-sm hover:border-primary/50 transition-colors group">
          <Palette className="w-8 h-8 text-primary mb-4 opacity-80 group-hover:opacity-100 transition-opacity" />
          <h2 className="text-2xl font-headline mb-3">当前范围</h2>
          <p className="text-on-surface-variant leading-relaxed">
            本期只聚焦报名、审核、参与者时间段与资料补录，不包含最终公开作品归档页。
          </p>
        </div>
        <div className="p-8 border border-outline-variant bg-surface-container-low/50 rounded-2xl backdrop-blur-sm hover:border-tertiary/50 transition-colors group">
          <Scroll className="w-8 h-8 text-tertiary mb-4 opacity-80 group-hover:opacity-100 transition-opacity" />
          <h2 className="text-2xl font-headline mb-3">当前入口</h2>
          <p className="text-on-surface-variant leading-relaxed">
            公共页负责说明，正式报名统一收口到参与者入口。管理员通过 Cloudflare Access 进入后台处理审核与排期。
          </p>
        </div>
      </section>
    </div>
  );
}
