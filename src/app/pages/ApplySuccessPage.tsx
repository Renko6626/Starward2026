import { Link } from "@tanstack/react-router";
import { CheckCircle2, ArrowRight } from "lucide-react";

export function ApplySuccessPage() {
  return (
    <section className="success-page">
      <CheckCircle2 size={42} strokeWidth={1} />
      <span className="eyebrow">APPLICATION RECEIVED</span>
      <h1>已收到你的创作意向。</h1>
      <p>
        报名已提交，接下来请等待主催审核。你可以回到创作者空间查看进度，审核通过后可填写作品资料。
      </p>
      <div className="hero-actions">
        <Link className="button button--primary" to="/portal">
          返回我的工作台 <ArrowRight size={16} />
        </Link>
        <Link className="button button--secondary" to="/">
          回到活动首页
        </Link>
      </div>
    </section>
  );
}
