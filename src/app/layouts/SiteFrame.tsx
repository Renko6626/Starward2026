import { PropsWithChildren } from "react";
import { Link } from "@tanstack/react-router";

const navItems = [
  { label: "开始页", to: "/", exact: true },
  { label: "报名", to: "/apply", exact: false },
  { label: "后台", to: "/admin", exact: false },
  { label: "参与者登录", to: "/portal/login", exact: true },
  { label: "我的接力", to: "/portal", exact: false },
] as const;

export function SiteFrame({ children }: PropsWithChildren) {
  return (
    <div className="site-shell">
      <header className="site-header">
        <div>
          <p className="site-title">Starward2026</p>
          <p className="site-subtitle">秘封组同人接力创作活动站</p>
        </div>
        <nav className="site-nav" aria-label="Primary">
          {navItems.map((item) => (
            <Link
              key={item.to}
              activeOptions={item.exact ? { exact: true } : undefined}
              activeProps={{ className: "site-nav__link site-nav__link--active" }}
              inactiveProps={{ className: "site-nav__link" }}
              to={item.to}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="site-main">{children}</main>
    </div>
  );
}
