import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { ScrollProgress } from "../components/ScrollProgress";

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
  }, [menuOpen]);
  const { pathname } = useLocation();
  const isWorkspace =
    (pathname.startsWith("/portal") && pathname !== "/portal/login") ||
    pathname.startsWith("/admin");
  if (isWorkspace) return <>{children}</>;
  return (
    <div className={`public-site ${pathname === "/" ? "public-site--home" : pathname === "/apply" || pathname === "/apply/" ? "public-site--guide" : pathname === "/portal/login" || pathname === "/portal/login/" ? "public-site--entry" : ""}`}>
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
          <Link to="/works" search={{ view: "gallery", type: "all", q: "" }} onClick={() => setMenuOpen(false)}>作品展示</Link>
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
        <span className="footer-brand"><img src="/brand/moon-phase.png" alt="" width={32} height={28} />逐星巡礼</span>
        <span>Starward Pilgrimage</span>
      </footer>
    </div>
  );
}
