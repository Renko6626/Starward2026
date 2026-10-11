import { useSiteTranslation } from "../../i18n/use-site-translation";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { authClient } from "../../portal/lib/auth-client";
import { useApplicationIntake } from "../lib/use-application-intake";
import { getApplicationWindowLabel } from "../../shared/windows";
import { StationTechnicalDrawing } from "../components/StationTechnicalDrawing";
import { ActivityIdentity } from "../components/ActivityIdentity";
import "./apply.css";
import "../components/ui/buttons.css";

const steps = [
  { title: "public.apply.step1", body: "public.apply.step1Body" },
  { title: "public.apply.step2", body: "public.apply.step2Body" },
  { title: "public.apply.step3", body: "public.apply.step3Body" },
];

export function ApplyPage() {
  const { t, label } = useSiteTranslation();
  const { data: session } = authClient.useSession();
  const intake = useApplicationIntake();
  const isOpen = intake.status === "ready" && intake.payload.isOpen;
  const status = intake.status === "loading" ? t("public.apply.loading")
    : intake.status === "error" ? t("public.apply.error")
    : label(getApplicationWindowLabel(intake.payload.window));
  const statusNote = intake.status === "loading" ? t("public.apply.loadingNote")
    : intake.status === "error" ? intake.message
    : isOpen ? t("public.apply.openNote")
    : intake.payload.window?.state === "ended" ? t("public.apply.endedNote")
    : t("public.apply.beforeNote");
  const entryLabel = session ? t("public.apply.workspace") : isOpen ? t("public.home.start") : t("public.apply.register");

  return (
    <div className="participation-guide">
      <aside className="participation-aside">
        <div className="participation-aside-copy">
          <h1>{t("public.nav.guide")}</h1>
          <ActivityIdentity />
          <Link to="/" className="participation-back"><ArrowLeft size={14} /> {t("public.apply.back")}</Link>
        </div>
        <div className="participation-artwork"><StationTechnicalDrawing variant="guide" /></div>
      </aside>
      <div className="participation-content">
        <section className="participation-status" aria-labelledby="participation-status-title">
          <p className="participation-section-label">{t("public.apply.status")}</p>
          <div role="status" aria-live="polite">
            <h2 id="participation-status-title"><span className={`participation-status-dot${isOpen ? " is-open" : ""}`} aria-hidden="true" />{status}</h2>
            <p>{statusNote}</p>
          </div>
          <Link to={session ? "/portal" : "/portal/login"} className="button button--primary button--industrial button--accent participation-action">
            {entryLabel}<ArrowUpRight size={18} />
          </Link>
          <p className="participation-action-note">{session ? t("public.apply.progress") : t("public.apply.signIn")}</p>
          <Link className="participation-rules-link" to="/rules">{t("public.apply.rules")} <ArrowUpRight size={14} /></Link>
        </section>
        <section className="participation-section" aria-labelledby="participation-steps-title">
          <div className="participation-section-heading"><h2 id="participation-steps-title">{t("public.apply.steps")}</h2></div>
          <ol className="participation-steps">
            {steps.map((step, index) => <li key={step.title}>
              <span className="participation-step-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <div><h3>{t(step.title)}</h3><p>{t(step.body)}</p></div>
            </li>)}
          </ol>
          <p className="participation-success-note">{t("public.apply.successNote")}</p>
        </section>
        <section className="participation-section" aria-labelledby="participation-next-title">
          <div className="participation-section-heading"><h2 id="participation-next-title">{t("public.apply.next")}</h2></div>
          <dl className="participation-followup">
            <div><dt>{t("public.apply.create")}</dt><dd>{t("public.apply.createBody")}</dd></div>
            <div><dt>{t("public.apply.submit")}</dt><dd><strong>{t("public.apply.deadline")}</strong>{t("public.apply.submitBody")}</dd></div>
            <div><dt>{t("public.apply.release")}</dt><dd>{t("public.apply.releaseBody")}</dd></div>
          </dl>
        </section>
        <div className="participation-closing">
          <Link to={session ? "/portal" : "/portal/login"}>{entryLabel}<ArrowUpRight size={16} /></Link>
        </div>
      </div>
    </div>
  );
}
