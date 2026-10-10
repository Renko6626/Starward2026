import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { ACTIVITY_RULES_TITLE, ACTIVITY_RULES_VERSION, ACTIVITY_RULES_UPDATED_AT, activityRulesSections } from "../../shared/activity-rules";
import "./rules.css";

export function RulesPage() {
  return <article className="rules-page" aria-labelledby="rules-title">
    <header className="rules-header">
      <Link className="rules-back" to="/apply"><ArrowLeft size={14} /> 参与指南</Link>
      <h1 id="rules-title">{ACTIVITY_RULES_TITLE}</h1>
      <dl className="rules-version"><div><dt>规则版本</dt><dd>{ACTIVITY_RULES_VERSION}</dd></div><div><dt>更新日期</dt><dd><time dateTime={ACTIVITY_RULES_UPDATED_AT}>{ACTIVITY_RULES_UPDATED_AT}</time></dd></div></dl>
      <p>注册前请阅读以下规则。确认同意后，回到账号页面继续注册。</p>
    </header>
    <div className="rules-layout">
      <nav className="rules-contents" aria-label="活动规则章节">
        <h2>目录</h2>
        {activityRulesSections.map(section => <a key={section.id} href={`#rules-${section.id}`}>{section.title}</a>)}
      </nav>
      <div className="rules-text">
        {activityRulesSections.map(section => <section key={section.id} id={`rules-${section.id}`} className={section.id === "rights" ? "rules-section rules-section--rights" : "rules-section"} aria-labelledby={`rules-heading-${section.id}`}>
          <h2 id={`rules-heading-${section.id}`}>{section.title}</h2>
          {section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </section>)}
        <div className="rules-actions"><Link to="/apply">查看参与指南</Link><Link className="button button--secondary" to="/portal/login">前往账号入口 <ArrowUpRight size={16} /></Link></div>
      </div>
    </div>
  </article>;
}
