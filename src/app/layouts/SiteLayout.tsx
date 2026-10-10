import { useEffect, useId, useRef, useState, type PropsWithChildren } from "react";
import { Link, useLocation, useRouterState } from "@tanstack/react-router";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { ScrollProgress } from "../components/ScrollProgress";
import { AnimatePresence, LayoutGroup, motion, useIsPresent } from "motion/react";

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="逐星巡礼首页">
      <img className="brand-emblem" src="/brand/moon-phase.png" alt="" width={44} height={38} />
      <span>
        逐星巡礼<small>Starward Pilgrimage</small>
      </span>
    </Link>
  );
}

export function SiteHeader() {
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
          aria-label={menuOpen ? "关闭导航" : "打开导航"}
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
            {({ isActive }) => <>活动首页<NavigationIndicator active={isActive} mobile={mobile} reduced={!!reduced} /></>}
          </Link>
          <Link to="/works" search={{ view: "gallery", type: "all", q: "" }} activeOptions={{ includeSearch: false }} onClick={() => setMenuOpen(false)}>
            {({ isActive }) => <>时间表<NavigationIndicator active={isActive} mobile={mobile} reduced={!!reduced} /></>}
          </Link>
          <Link to="/apply" onClick={() => setMenuOpen(false)}>
            {({ isActive }) => <>参与指南<NavigationIndicator active={isActive} mobile={mobile} reduced={!!reduced} /></>}
          </Link>
          <Link
            className="nav-entry"
            to={pathname.startsWith("/portal") && pathname !== "/portal/login" ? "/portal" : "/portal/login"}
            onClick={() => setMenuOpen(false)}
          >
            {({ isActive }) => <>作者页面 <ArrowUpRight size={15} /><NavigationIndicator active={isActive} mobile={mobile} reduced={!!reduced} /></>}
          </Link>
        </NavigationPanel>}
        </AnimatePresence>
        </LayoutGroup>
      </header>
  );
}

function NavigationPanel({ mobile, reduced, children }: PropsWithChildren<{ mobile: boolean; reduced: boolean }>) {
  const present = useIsPresent();
  return <motion.nav id="public-navigation" className="public-nav is-open" aria-label="站点导航"
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
  return (
    <footer className="public-footer">
      <div className="footer-main">
        <div className="footer-identity">
          <span className="footer-brand"><img src="/brand/moon-phase.png" alt="" width={32} height={28} />逐星巡礼</span>
          <span>Starward Pilgrimage</span>
        </div>
        <nav className="footer-links" aria-label="页脚导航">
          <Link to="/apply">参与指南</Link>
          <Link to="/rules">活动规则</Link>
          <a href="/tos">服务条款</a>
          <a href="/privacy">隐私政策</a>
        </nav>
      </div>
      <div className="footer-contact">
        <span>主办方：逐星巡礼组委会</span>
        <span>活动 QQ 群：1078039621</span>
      </div>
    </footer>
  );
}

export function SiteLayout({ children }: PropsWithChildren) {
  const pending = useRouterState({ select: state => state.isLoading || state.isTransitioning });
  const activePath = useRouterState({ select: state => state.matches.at(-1)?.pathname ?? state.location.pathname });
  const pathname = activePath.replace(/\/+$/, "") || "/";
  const isWorkspace =
    (pathname.startsWith("/portal") && pathname !== "/portal/login") ||
    (pathname === '/admin' || pathname.startsWith('/admin/'));
  if (isWorkspace) return <>{children}</>;
  return (
    <div className={`public-site ${pathname === "/" ? "public-site--home" : pathname === "/apply" ? "public-site--guide" : pathname === "/portal/login" ? "public-site--entry" : ""}`}>
      <ScrollProgress key={pathname} />
      <a className="skip-link" href="#main-content">跳至正文</a>
      <SiteHeader />
      <main id="main-content" className="public-main" aria-busy={pending}>
        <div className="route-stage">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
