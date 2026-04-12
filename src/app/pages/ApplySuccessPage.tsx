import { Link } from "@tanstack/react-router";

export function ApplySuccessPage() {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-8 relative z-10 text-center mt-20">
      <h1 className="text-2xl font-headline tracking-tight text-tertiary">报名已提交</h1>
      <p className="text-on-surface-variant">当前报名已经绑定到你的参与者入口账号。后续继续使用同一邮箱登录，即可查看审核状态并维护资料。</p>
      <div className="flex items-center justify-center gap-3 flex-wrap pt-4">
        <Link className="px-6 py-3 bg-primary text-on-primary rounded-full font-medium hover:bg-primary/90 transition-colors" to="/portal">
          返回参与者门户
        </Link>
        <Link className="px-6 py-3 bg-surface-variant text-on-surface rounded-full font-medium hover:bg-surface-bright transition-colors border border-outline-variant" to="/">
          返回开始页
        </Link>
      </div>
    </div>
  );
}
