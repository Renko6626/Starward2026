import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { ArrowUpRight, Compass, Menu, X } from "lucide-react";

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="Starward 首页">
      <Compass size={27} strokeWidth={1.2} />
      <span>
        STARWARD<small>秘封 · 创作接力 2026</small>
      </span>
    </Link>
  );
}

export function SiteLayout({ children }: PropsWithChildren) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuTrigger.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);
  const { pathname } = useLocation();
  const isWorkspace =
    (pathname.startsWith("/portal") && pathname !== "/portal/login") ||
    pathname.startsWith("/admin");
  if (isWorkspace) return <>{children}</>;
  return (
    <div className="public-site">
      <ScrollProgress key={pathname} />
      <a className="skip-link" href="#main-content">
        跳至正文
      </a>
      <header className="public-header">
        <Brand />
        <button
          className="icon-button mobile-menu-button"
          type="button"
          aria-label={menuOpen ? "关闭导航" : "打开导航"}
          aria-expanded={menuOpen}
          ref={menuTrigger}
          aria-controls="public-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
        <nav
          id="public-navigation"
          className={`public-nav ${menuOpen ? "is-open" : ""}`}
          aria-label="站点导航"
        >
          <Link
            to="/"
            activeOptions={{ exact: true }}
            onClick={() => setMenuOpen(false)}
          >
            活动首页
          </Link>
          <Link to="/apply" onClick={() => setMenuOpen(false)}>
            参与指南
          </Link>
          <Link
            className="nav-entry"
            to="/portal/login"
            onClick={() => setMenuOpen(false)}
          >
            创作者入口 <ArrowUpRight size={15} />
          </Link>
        </nav>
      </header>
      <main id="main-content" className="public-main">
        <div className="route-stage" key={pathname}>
          {children}
        </div>
      </main>
      <footer className="public-footer">
        <span>
          STARWARD 2026 <span className="footer-divider">/</span>{" "}
          秘封组同人创作接力
        </span>
        <span>在故事交汇之处，继续观测。</span>
      </footer>
    </div>
  );
}
import { ScrollProgress } from "../components/ScrollProgress";
