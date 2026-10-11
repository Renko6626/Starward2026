import { useSiteTranslation } from "../../i18n/use-site-translation";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { ACTIVITY_RULES_UPDATED_AT, getActivityRulesContent } from "../../shared/activity-rules";
import "./rules.css";
import "../components/ui/buttons.css";

export function RulesPage() {
  const { t, language } = useSiteTranslation();
  const rules = getActivityRulesContent(language);
  return <article className="rules-page" aria-labelledby="rules-title">
    <header className="rules-header">
      <Link className="rules-back" to="/apply"><ArrowLeft size={14} /> {t("public.nav.guide")}</Link>
      <h1 id="rules-title">{rules.title}</h1>
      <dl className="rules-version"><div><dt>{t("public.rules.updated")}</dt><dd><time dateTime={ACTIVITY_RULES_UPDATED_AT}>{ACTIVITY_RULES_UPDATED_AT}</time></dd></div></dl>
      <p>{t("public.rules.intro")}</p>
    </header>
    <div className="rules-layout">
      <nav className="rules-contents" aria-label={t("public.rules.sections")}>
        <h2>{t("public.rules.contents")}</h2>
        {rules.sections.map(section => <a key={section.id} href={`#rules-${section.id}`}>{section.title}</a>)}
      </nav>
      <div className="rules-text">
        {rules.sections.map(section => <section key={section.id} id={`rules-${section.id}`} className={section.id === "rights" ? "rules-section rules-section--rights" : "rules-section"} aria-labelledby={`rules-heading-${section.id}`}>
          <h2 id={`rules-heading-${section.id}`}>{section.title}</h2>
          {section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          {section.id === "privacy" ? <p>{t("public.rules.privacyIntro")}<a href="/privacy">{t("public.rules.privacyLink")}</a>{language === "zh-CN" ? "。" : "."}</p> : null}
        </section>)}
        <div className="rules-actions"><Link to="/apply">{t("public.rules.guide")}</Link><Link className="button button--secondary button--industrial" to="/portal/login">{t("public.rules.account")} <ArrowUpRight size={16} /></Link></div>
      </div>
    </div>
  </article>;
}
