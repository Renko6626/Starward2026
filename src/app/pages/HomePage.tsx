import { Link } from "@tanstack/react-router";
import { ArrowRight, Palette, Scroll, Stars } from "../components/icons";

export function HomePage() {
  return (
    <div className="w-full max-w-5xl mx-auto space-y-12 relative z-10 py-8">
      <section className="text-center space-y-6 py-12 border-b border-outline-variant relative">
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
          <Stars className="w-96 h-96" />
        </div>
        <h1 className="text-5xl md:text-7xl font-headline tracking-tighter text-primary">
          STARWARD <span className="text-on-surface">2026</span>
        </h1>
        <p className="text-xl text-on-surface-variant max-w-2xl mx-auto font-light">秘封组同人创作接力活动站。</p>
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
            创作者入口
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-8 border border-outline-variant bg-surface-container-low/50 rounded-2xl backdrop-blur-sm hover:border-primary/50 transition-colors group">
          <Palette className="w-8 h-8 text-primary mb-4 opacity-80 group-hover:opacity-100 transition-opacity" />
          <h2 className="text-2xl font-headline mb-3">参与方式</h2>
          <p className="text-on-surface-variant leading-relaxed">
            阅读报名须知后，可通过创作者入口完成登录、资料填写与报名提交。审核通过后，时间段与作品信息也将在同一入口内继续维护。
          </p>
        </div>
        <div className="p-8 border border-outline-variant bg-surface-container-low/50 rounded-2xl backdrop-blur-sm hover:border-tertiary/50 transition-colors group">
          <Scroll className="w-8 h-8 text-tertiary mb-4 opacity-80 group-hover:opacity-100 transition-opacity" />
          <h2 className="text-2xl font-headline mb-3">站点内容</h2>
          <p className="text-on-surface-variant leading-relaxed">
            本站用于提供活动说明、参与入口与阶段更新。作品公开展示将在发布阶段开放，现阶段以报名与创作准备相关内容为主。
          </p>
        </div>
      </section>
    </div>
  );
}
