import { useSiteTranslation } from "../../i18n/use-site-translation";
import { useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { OrbitalArtwork } from '../components/OrbitalArtwork';
import { HomeSideGrid } from '../components/HomeSideGrid';
import { HomeWordmark } from '../components/HomeWordmark';
import { MissionCountdown } from '../components/MissionCountdown';
import { DesignReferences } from '../components/DesignReferences';
import { StationBackdrop } from '../components/station/StationBackdrop';
import { ScrollReveal } from '../components/ScrollReveal';
import { useApplicationIntake } from '../lib/use-application-intake';
import { getApplicationWindowLabel } from '../../shared/windows';
import './home.css';
import '../components/ui/buttons.css';

const steps = [
  { number: '01', title: "public.home.step1", body: "public.home.step1Body" },
  { number: '02', title: "public.home.step2", body: "public.home.step2Body" },
  { number: '03', title: "public.home.step3", body: "public.home.step3Body" },
];

export function HomePage() {
  const { t, language, label } = useSiteTranslation();
  const [motionPaused, setMotionPaused] = useState(false);
  const motionControls = useRef<HTMLDivElement>(null);
  const intake = useApplicationIntake(30_000);
  const statistics = intake.status === 'ready' ? intake.payload.statistics : null;
  const isOpen = intake.status === 'ready' && intake.payload.isOpen;
  const status = intake.status === 'loading' ? t("public.home.loading")
    : intake.status === 'error' ? t("public.home.error")
    : label(getApplicationWindowLabel(intake.payload.window));
  return (
    <div className="station-home">
      <StationBackdrop paused={motionPaused} onTogglePaused={() => setMotionPaused(value => !value)} controlsContainer={motionControls} />
      <HomeSideGrid />
      <section className="orbital-hero" aria-labelledby="home-title">
        <OrbitalArtwork paused={motionPaused} />
        <div className="orbital-copy">
          <div className="orbital-title">
            {language === 'en' ? <h1 id="home-title" className="orbital-heading--wordmark"><HomeWordmark stacked /></h1> : <>
              <h1 id="home-title">{t("public.brand")}</h1>
              <p className="orbital-edition"><HomeWordmark /></p>
            </>}
          </div>
          <p className="orbital-subtitle">{t("public.home.subtitle")}</p>
          <div className="orbital-actions">
            <Link className="button button--primary button--industrial button--accent orbital-primary" to="/apply">{t("public.home.join")} <ArrowUpRight size={18} /></Link>
            <Link className="orbital-secondary" to="/works" search={{ view: 'gallery', type: 'all', q: '' }}>{t("public.home.works")} <ArrowUpRight size={15} /></Link>
          </div>
          <div className="orbital-meta">
            <p className="orbital-event-date"><span>{t("public.home.date")}</span><time dateTime="2026-11-12">{new Intl.DateTimeFormat(language, { timeZone: "Asia/Shanghai", year: "numeric", month: "short", day: "numeric" }).format(new Date("2026-11-12T00:00:00+08:00"))}</time></p>
            <p className="orbital-group"><span>{t("public.home.group")}</span><span className="orbital-group-number">1078039621</span></p>
          </div>
        </div>
        <div className="orbital-bottom">
          <div className="orbital-status" role="status">
            <span className={`orbital-status-light ${isOpen ? 'is-open' : ''}`} aria-hidden="true" />
            <span>{t("public.home.status")}</span><strong>{status}</strong>
            {intake.status === 'error' ? <span className="orbital-status-error">{intake.message}</span> : null}
          </div>
          <div className="orbital-controls">
            <a className="orbital-scroll" href="#participate-relay">{t("public.home.how")} <ArrowDown size={13} /></a>
            <div ref={motionControls} />
          </div>
        </div>
      </section>
      <MissionCountdown />
      <section id="participate-relay" className="relay-route" aria-labelledby="route-title">
        <div className="relay-route-heading"><h2 id="route-title">{t("public.home.join")}</h2><Link to="/apply">{t("public.home.guide")} <ArrowUpRight size={15} /></Link></div>
        <ol className="relay-steps">
          {steps.map(step => <li key={step.number}>
            <div className="relay-step">
              <div className="relay-step-heading"><span className="relay-step-number" aria-hidden="true">{step.number}</span><h3>{t(step.title)}</h3></div>
              <p>{t(step.body)}</p>
            </div>
          </li>)}
        </ol>
        <div className="relay-actions">
          <Link className="relay-start" to="/portal/login">{t("public.home.start")} <ArrowUpRight size={18} /></Link>
          <p className="relay-enrollment-note">{t("public.home.reservation")}</p>
        </div>
        <div className="relay-statistics" aria-live="polite">
          {statistics ? <dl>
            <div><dt>{t("public.home.creators")}</dt><dd><strong>{statistics.registeredCreators}</strong><span>{t("public.home.people")}</span></dd></div>
            <div><dt>{t("public.home.occupied")}</dt><dd>{statistics.schedule && statistics.schedule.total > 0
              ? <><strong>{statistics.schedule.occupied}</strong><span className="relay-statistics-divider">/</span><strong>{statistics.schedule.total}</strong></>
              : <span className="relay-statistics-note">{t("public.home.preparing")}</span>}</dd></div>
          </dl> : <p className="relay-statistics-note">{intake.status === 'loading' ? t("public.home.statsLoading") : t("public.home.statsError")}</p>}
        </div>
      </section>
      <section id="about-relay" className="relay-intro" aria-labelledby="relay-title">
        <ScrollReveal className="relay-poster">
          <img src="/images/starward-2026-poster.webp" width={1280} height={829} loading="lazy" decoding="async"
            alt={t("public.home.poster")} />
        </ScrollReveal>
        <ScrollReveal className="relay-about-copy">
          <div className="relay-heading"><h2 id="relay-title">{t("public.home.about")}</h2></div>
          <div className="relay-statement">
            <p>{t("public.home.about1")}</p>
            <p>{t("public.home.about2")}</p>
            <p>{t("public.home.about3")}</p>
            <div className="relay-about-links"><Link to="/apply">{t("public.nav.guide")} <ArrowUpRight size={14} /></Link><Link to="/rules">{t("public.home.rules")} <ArrowUpRight size={14} /></Link></div>
          </div>
        </ScrollReveal>
      </section>
      <DesignReferences />
    </div>
  );
}
