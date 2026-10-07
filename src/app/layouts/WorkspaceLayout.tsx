import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  FilePenLine,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { Brand } from "./SiteLayout";
import { ScrollProgress } from "../components/ScrollProgress";
import { authClient } from "../../portal/lib/auth-client";

const adminItems = [
  { to: "/admin", label: "活动总览", icon: LayoutDashboard },
  { to: "/admin/applications", label: "报名审核", icon: ClipboardList },
  { to: "/admin/participants", label: "创作者名册", icon: Users },
  { to: "/admin/project-drafts", label: "作品审核", icon: FilePenLine },
  { to: "/admin/schedule", label: "接力排期", icon: CalendarDays },
  { to: "/admin/settings/windows", label: "开放窗口", icon: Settings2 },
] as const;

export function WorkspaceLayout({
  kind,
  children,
}: PropsWithChildren<{ kind: "portal" | "admin" }>) {
  const [open, setOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        menuTrigger.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);
  const { pathname } = useLocation();
  const items = adminItems;
  const current = [...items]
    .reverse()
    .find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
  if (kind === "portal") {
    return <div className="creator-shell">
      <a className="skip-link" href="#main-content">跳至正文</a>
      <header className="creator-header">
        <Brand />
        <div className="creator-header-actions"><Link to="/apply">参与指南</Link><PortalAccount /></div>
      </header>
      <nav className="creator-section-nav" aria-label="工作台区块导航">
        <a href="#plan">计划与时段</a><a href="#tasks">待办与反馈</a><a href="#project">作品资料</a><a href="#profile">署名与联系</a><a href="#history">参与记录</a>
      </nav>
      <main id="main-content" className="creator-content">{children}</main>
      <footer className="creator-footer"><span>逐星巡礼 2026</span><Link to="/">返回活动首页 <ArrowUpRight size={14} /></Link></footer>
    </div>;
  }
  return (
    <div className={`workspace workspace--${kind}`}>

      <ScrollProgress key={pathname} />
      <a className="skip-link" href="#main-content">
        跳至正文
      </a>
      <button
        className={`sidebar-scrim ${open ? "is-open" : ""}`}
        aria-label="关闭导航"
        aria-hidden={!open}
        disabled={!open}
        tabIndex={-1}
        type="button"
        onClick={() => setOpen(false)}
      />
      <aside
        className={`workspace-sidebar ${open ? "is-open" : ""}`}
        id="workspace-navigation"
      >
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-button mobile-menu-button"
            type="button"
            aria-label="关闭导航"
            onClick={() => setOpen(false)}
          >
            <X />
          </button>
        </div>
        <div className="sidebar-caption">
          {kind === "admin" ? "ORGANIZER / 活动管理" : "CREATOR / 创作空间"}
        </div>
        <nav aria-label={kind === "admin" ? "管理后台导航" : "创作者导航"}>
          {items.map(({ to, label, icon: Icon }, index) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/admin" }}
              className="workspace-nav-item"
              onClick={() => setOpen(false)}
            >
              <Icon size={18} strokeWidth={1.5} />
              <span>{label}</span>
              <small>0{index + 1}</small>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link to="/" className="sidebar-site-link">
            返回活动站点 <ArrowUpRight size={15} />
          </Link>
          <p>
            STARWARD · 2026
            <br />
            {kind === "admin"
              ? "每一份创作，都值得认真回应。"
              : "把你的故事，交给下一束星光。"}
          </p>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-topbar">
          <div>
            <button
              className="icon-button mobile-menu-button"
              type="button"
              aria-label="打开导航"
              aria-expanded={open}
              ref={menuTrigger}
              aria-controls="workspace-navigation"
              onClick={() => setOpen(!open)}
            >
              <Menu />
            </button>
            <span>{kind === "admin" ? "主催控制台" : "创作者空间"}</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{current?.label}</strong>
          </div>
          {kind === "admin" ? (
            <span className="workspace-identity">
              <ShieldCheck size={15} />
              主催管理
            </span>
          ) : (
            <PortalAccount />
          )}
        </header>
        <main id="main-content" className="workspace-content">
          <div className="route-stage" key={pathname}>
            {children}
          </div>
        </main>
        <footer className="workspace-footer">
          STARWARD 2026 <span>秘封组同人创作接力</span>
        </footer>
      </div>
    </div>
  );
}

function PortalAccount() {
  const { data } = authClient.useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function signOut() {
    setBusy(true);
    setError(false);
    try {
      const response = await authClient.signOut();
      if (response.error) {
        setError(true);
        return;
      }
      await navigate({ to: "/portal/login" });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="workspace-account">
      <span title={data?.user.email}>{data?.user.email}</span>
      {error ? <span role="alert">退出失败，请重试</span> : null}
      <button
        className="icon-button"
        type="button"
        aria-label="退出登录"
        disabled={busy}
        onClick={() => void signOut()}
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}
