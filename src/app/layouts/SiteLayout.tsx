import { useSiteTranslation } from "../../i18n/use-site-translation";
import { useEffect, useId, useRef, useState, type PropsWithChildren } from "react";
import { Link, useLocation, useRouterState } from "@tanstack/react-router";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { ScrollProgress } from "../components/ScrollProgress";
import { AnimatePresence, LayoutGroup, motion, useIsPresent } from "motion/react";
import { LanguageSwitcher } from "../../i18n/LanguageSwitcher";
import { useAdminNavigation } from '../lib/use-admin-navigation';

export function Brand() {
  const { t, language } = useSiteTranslation();
  return (
    <Link to="/" className="brand" aria-label={t("public.nav.brandHome")}>
      <img className="brand-emblem" src="/brand/moon-phase.png" alt="" width={44} height={38} />
      <span>
        {t("public.brand")}{language === 'zh-CN' ? <small>Starward Pilgrimage</small> : null}
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const { t } = useSiteTranslation();
  const showAdmin = useAdminNavigation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobile, setMobile] = useState(() => matchMedia('(max-width: 800px)').matches);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const navigationId = useId();
  const menuTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = matchMedia('(max-width: 800px)');
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setMobile(media.matches); setMenuOpen(false); };
    const updatePreference = () => setReduced(preference.matches);
    media.addEventListener('change', update);
    preference.addEventListener('change', updatePreference);
    return () => {
      media.removeEventListener('change', update);
      preference.removeEventListener('change', updatePreference);
    };
  }, []);
  useEffect(() => {
    if (!mobile || !menuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuTrigger.current?.focus();
      }
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !menuTrigger.current?.contains(target) &&
        !document.getElementById("public-navigation")?.contains(target)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobile, menuOpen]);
  const location = useLocation();
  const pathname = location.pathname.replace(/\/+$/, "") || "/";
  return (
      <header className="public-header">
        <Brand />
        <button
          className="icon-button mobile-menu-button"
          type="button"
          aria-label={menuOpen ? t("public.nav.close") : t("public.nav.open")}
          aria-expanded={menuOpen}
          ref={menuTrigger}
          aria-controls={!mobile || menuOpen ? "public-navigation" : undefined}
          onClick={() => setMenuOpen(value => !value)}
        >
          <span className="navigation-toggle-icon" aria-hidden="true">
            <AnimatePresence initial={false}>
              <motion.span key={menuOpen ? 'close' : 'menu'}
                initial={{ opacity: 0, rotate: reduced ? 0 : -45 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: reduced ? 0 : 45 }}
                transition={{ duration: reduced ? 0 : .12 }}>
                {menuOpen ? <X /> : <Menu />}
              </motion.span>
            </AnimatePresence>
          </span>
        </button>
        <LayoutGroup id={navigationId}>
        <AnimatePresence initial={false}>
        {(!mobile || menuOpen) && <NavigationPanel mobile={mobile} reduced={!!reduced}>
          <Link
            to="/"
            activeOptions={{ exact: true }}
            onClick={() => setMenuOpen(false)}
          >
            {({ isActive }) => <>{t("public.nav.home")}<NavigationIndicator active={isActive} mobile={mobile} reduced={!!reduced} /></>}
          </Link>
          <Link to="/works" search={{ view: "gallery", type: "all", q: "" }} activeOptions={{ includeSearch: false }} onClick={() => setMenuOpen(false)}>
            {({ isActive }) => <>{t("public.nav.schedule")}<NavigationIndicator active={isActive} mobile={mobile} reduced={!!reduced} /></>}
          </Link>
          <Link to="/apply" onClick={() => setMenuOpen(false)}>
            {({ isActive }) => <>{t("public.nav.guide")}<NavigationIndicator active={isActive} mobile={mobile} reduced={!!reduced} /></>}
          </Link>
          <Link
            className="nav-entry"
            to={pathname.startsWith("/portal") && pathname !== "/portal/login" ? "/portal" : "/portal/login"}
            activeOptions={{ exact: pathname === '/portal/admin' || pathname.startsWith('/portal/admin/') }}
            onClick={() => setMenuOpen(false)}
          >
            {({ isActive }) => <>{t("public.nav.author")} <ArrowUpRight size={15} /><NavigationIndicator active={isActive} mobile={mobile} reduced={!!reduced} /></>}
          </Link>
          {showAdmin ? <Link to="/portal/admin" onClick={() => setMenuOpen(false)}>
            {({ isActive }) => <>{t("public.nav.admin")} <ArrowUpRight size={15} /><NavigationIndicator active={isActive} mobile={mobile} reduced={!!reduced} /></>}
          </Link> : null}
          {!pathname.startsWith("/portal/admin") && <LanguageSwitcher />}
        </NavigationPanel>}
        </AnimatePresence>
        </LayoutGroup>
      </header>
  );
}

function NavigationPanel({ mobile, reduced, children }: PropsWithChildren<{ mobile: boolean; reduced: boolean }>) {
  const { t } = useSiteTranslation();
  const present = useIsPresent();
  return <motion.nav id="public-navigation" className="public-nav is-open" aria-label={t("public.nav.site")}
    inert={!present} aria-hidden={!present || undefined}
    initial={mobile ? { opacity: 0, y: reduced ? 0 : -6 } : false}
    animate={{ opacity: 1, y: 0, transition: { duration: reduced || !mobile ? 0 : .18, ease: 'easeOut' } }}
    exit={{ opacity: 0, y: reduced ? 0 : -4, transition: { duration: reduced ? 0 : .12, ease: 'easeIn' } }}>
    {children}
  </motion.nav>;
}

function NavigationIndicator({ active, mobile, reduced }: { active: boolean; mobile: boolean; reduced: boolean }) {
  return active ? <motion.span className="navigation-active-mark" aria-hidden="true"
    layoutId={`navigation-active-${mobile ? 'mobile' : 'desktop'}`}
    transition={{ duration: reduced ? 0 : .2, ease: [.22, 1, .36, 1] }} /> : null;
}

export function SiteFooter() {
  const { t, language } = useSiteTranslation();
  return (
    <footer className="public-footer">
      <div className="footer-main">
        <div className="footer-identity">
          <span className="footer-brand"><img src="/brand/moon-phase.png" alt="" width={32} height={28} />{t("public.brand")}</span>
          {language === 'zh-CN' ? <span>Starward Pilgrimage</span> : null}
        </div>
        <nav className="footer-links" aria-label={t("public.nav.footer")}>
          <Link to="/apply">{t("public.nav.guide")}</Link>
          <Link to="/rules">{t("public.nav.rules")}</Link>
          <a href="/tos">{t("public.nav.terms")}</a>
          <a href="/privacy">{t("public.nav.privacy")}</a>
        </nav>
      </div>
      <div className="footer-contact">
        <span>{t("public.footer.organizer")}</span>
        <span>{t("public.footer.group")}</span>
      </div>
    </footer>
  );
}

export function SiteLayout({ children }: PropsWithChildren) {
  const { t } = useSiteTranslation();
  const pending = useRouterState({ select: state => state.isLoading || state.isTransitioning });
  const activePath = useRouterState({ select: state => state.matches.at(-1)?.pathname ?? state.location.pathname });
  const pathname = activePath.replace(/\/+$/, "") || "/";
  const isWorkspace =
    pathname.startsWith("/portal") && !['/portal/login', '/portal/admin-access'].includes(pathname);
  if (isWorkspace) return <>{children}</>;
  return (
    <div className={`public-site ${pathname === "/" ? "public-site--home" : pathname === "/apply" ? "public-site--guide" : pathname === "/portal/login" ? "public-site--entry" : ""}`}>
      <ScrollProgress key={pathname} />
      <a className="skip-link" href="#main-content">{t("public.nav.skip")}</a>
      <SiteHeader />
      <main id="main-content" className="public-main" aria-busy={pending}>
        <div className="route-stage">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
