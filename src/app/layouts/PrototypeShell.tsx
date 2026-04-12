import { type PropsWithChildren } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Terminal } from "../components/icons";
import { cn } from "../lib/cn";

export function PrototypeShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

  return (
    <div className="min-h-dvh bg-background text-on-background font-geist">
      <header className="sticky top-0 z-40 border-b border-outline-variant bg-surface-container-low/70 backdrop-blur-md">
        <div className="flex h-16 w-full items-center justify-between gap-6 px-4 lg:px-8">
          <Link className="flex items-center gap-2 text-primary" to="/">
            <Terminal className="w-6 h-6" />
            <span className="font-bold tracking-widest text-lg font-headline">STARWARD</span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-3">
            <TopNavItem label="首页" to="/" />
            <TopNavItem label="报名须知" to="/apply" />
            <TopNavItem label="创作者入口" to="/portal/login" />
            {isAdminRoute ? <TopNavItem label="管理后台" to="/admin" /> : null}
          </nav>
        </div>
      </header>

      <main className="min-h-[calc(100dvh-4rem)] w-full overflow-y-auto custom-scrollbar p-4 lg:p-8 grid-bg relative">
        <div className="mist-effect absolute inset-0 pointer-events-none" />
        {children}
      </main>
    </div>
  );
}

function TopNavItem({ label, to }: { label: string; to: string }) {
  return (
    <Link
      activeProps={{ className: "border-primary/40 bg-primary/10 text-primary" }}
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        "border-outline-variant bg-surface-variant text-on-surface-variant hover:bg-surface-bright hover:text-on-surface",
      )}
      to={to}
    >
      {label}
    </Link>
  );
}
