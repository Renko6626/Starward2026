import { type PropsWithChildren, type ReactNode, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Bell, Database, Globe, Menu, Search, Settings, Terminal, UserCircle } from "../components/icons";
import { cn } from "../lib/cn";

export function PrototypeShell({ children }: PropsWithChildren) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();

  return (
    <div className="min-h-dvh bg-background text-on-background flex overflow-hidden font-geist">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-surface-container-low border-r border-outline-variant transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
          !isSidebarOpen && "-translate-x-full md:w-20",
        )}
      >
        <div className="h-16 flex items-center px-4 border-b border-outline-variant">
          <div className="flex items-center gap-2 text-primary">
            <Terminal className="w-6 h-6" />
            {isSidebarOpen ? <span className="font-bold tracking-widest text-lg font-headline">STARWARD</span> : null}
          </div>
        </div>

        <nav className="p-4 space-y-2">
          <NavItem icon={<Globe className="w-5 h-5" />} isOpen={isSidebarOpen} label="公开站点" to="/" />
          <NavItem icon={<UserCircle className="w-5 h-5" />} isOpen={isSidebarOpen} label="参与者门户" to="/portal" />
          <NavItem icon={<Database className="w-5 h-5" />} isOpen={isSidebarOpen} label="管理后台" to="/admin" />
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-outline-variant">
          <NavItem icon={<Settings className="w-5 h-5" />} isOpen={isSidebarOpen} label="设置" to="/portal/profile" />
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 flex items-center justify-between px-4 lg:px-8 border-b border-outline-variant bg-surface-container-low/50 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button
              aria-label="Toggle Sidebar"
              className="p-2 hover:bg-surface-variant rounded-md transition-colors md:hidden"
              onClick={() => setIsSidebarOpen((current) => !current)}
              type="button"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden md:flex items-center gap-2 text-sm text-on-surface-variant font-mono">
              <span>STARWARD 2026</span>
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
              <span className="text-tertiary">企划筹备中</span>
              <span className="ml-4 text-xs opacity-50">{location.pathname}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                className="w-64 bg-surface-variant border border-outline-variant rounded-md py-1.5 pl-9 pr-4 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono placeholder:text-on-surface-variant/50"
                placeholder="搜索创作者或作品..."
                type="text"
              />
            </div>
            <button className="p-2 hover:bg-surface-variant rounded-md transition-colors relative" type="button">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full border-2 border-background" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-8 grid-bg relative">
          <div className="mist-effect absolute inset-0 pointer-events-none" />
          {children}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, to, isOpen }: { icon: ReactNode; label: string; to: string; isOpen: boolean }) {
  return (
    <Link
      activeProps={{ className: "bg-primary/10 text-primary" }}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors group"
      inactiveProps={{ className: "text-on-surface-variant hover:bg-surface-variant hover:text-on-surface" }}
      to={to}
    >
      <div className="flex-shrink-0 group-hover:text-on-surface transition-colors">{icon}</div>
      {isOpen ? <span className="text-sm font-medium tracking-wide text-left flex-1 truncate">{label}</span> : null}
    </Link>
  );
}
