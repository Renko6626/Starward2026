import { Link } from "@tanstack/react-router";
import { CheckCircle2, ArrowRight } from "lucide-react";
import "../components/ui/buttons.css";

export function ApplySuccessPage() {
  return (
    <section className="success-page">
      <CheckCircle2 size={42} strokeWidth={1} />
      <span className="eyebrow">APPLICATION RECEIVED</span>
      <h1>已收到你的创作意向。</h1>
      <p>
        恭喜您！报名已提交，所选时段已预留。请等待审核结果，若无大碍即视为您确定参与我们的活动。接下来只需要安心创作，等候后续通知即可。
      </p>
      <div className="hero-actions">
        <Link className="button button--primary button--industrial button--accent" to="/portal">
          返回作者页面 <ArrowRight size={16} />
        </Link>
        <Link className="button button--secondary button--industrial" to="/">
          回到活动首页
        </Link>
      </div>
    </section>
  );
}
