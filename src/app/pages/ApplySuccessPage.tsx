import { useSiteTranslation } from "../../i18n/use-site-translation";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, ArrowRight } from "lucide-react";
import "../components/ui/buttons.css";

export function ApplySuccessPage() {
  const { t } = useSiteTranslation();
  return (
    <section className="success-page">
      <CheckCircle2 size={42} strokeWidth={1} />
      <span className="eyebrow">APPLICATION RECEIVED</span>
      <h1>{t("public.success.title")}</h1>
      <p>
        {t("public.success.body")}
      </p>
      <div className="hero-actions">
        <Link className="button button--primary button--industrial button--accent" to="/portal">
          {t("public.success.workspace")} <ArrowRight size={16} />
        </Link>
        <Link className="button button--secondary button--industrial" to="/">
          {t("public.success.home")}
        </Link>
      </div>
    </section>
  );
}
