import { useEffect, useState, type PropsWithChildren } from 'react';
import { Link, useLocation, useNavigate, useRouterState } from '@tanstack/react-router';
import { CalendarDays, FilePenLine, Settings2, ShieldCheck, Users, UserCog } from 'lucide-react';
import { SiteHeader, SiteFooter } from '../../app/layouts/SiteLayout';
import { PortalAccount } from '../../app/layouts/WorkspaceLayout';
import { ApiError, requestJson } from '../../app/lib/api';
import type { AdminSession } from '../../shared/admin-access';
import '../admin.css';

const items = [
  { to: '/portal/admin/participants', label: '参与者管理', icon: Users },
  { to: '/portal/admin/project-drafts', label: '作品审核', icon: FilePenLine },
  { to: '/portal/admin/schedule', label: '接力排期', icon: CalendarDays },
  { to: '/portal/admin/settings/windows', label: '活动设置', icon: Settings2 },
] as const;

export function AdminLayout({ session: initial, children }: PropsWithChildren<{ session: AdminSession }>) {
  const [session, setSession] = useState(initial);
  const [denied, setDenied] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const pending = useRouterState({ select: state => state.isLoading || state.isTransitioning });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    function deny(event: Event) {
      if (!active) return;
      setDenied(true);
      const status = (event as CustomEvent<number>).detail;
      if (status === 401) void navigate({ to: '/portal/login', search: { returnTo: location.href }, replace: true });
      else void navigate({ to: '/portal/admin-access', search: { reason: 'forbidden', returnTo: location.href }, replace: true });
    }
    async function refresh() {
      if (document.hidden) return;
      try {
        const result = await requestJson<AdminSession>('/api/admin/session', { cache: 'no-store', signal: controller.signal });
        if (active) setSession(result);
      } catch (error) {
        if (error instanceof ApiError && [401, 403].includes(error.status)) deny(new CustomEvent('admin-access-lost', { detail: error.status }));
      }
    }
    window.addEventListener('admin-access-lost', deny);
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => { active = false; controller.abort(); clearInterval(timer); window.removeEventListener('admin-access-lost', deny); window.removeEventListener('focus', refresh); };
  }, [navigate, location.href]);
  if (denied) return null;
  const currentPath = location.pathname.startsWith('/portal/admin/applications') ? '/portal/admin/participants' : location.pathname;
  return <div className="creator-shell admin-shell">
    <a className="skip-link" href="#main-content">跳至正文</a>
    <SiteHeader />
    <div className="admin-masthead">
      <div><p className="eyebrow">STARWARD / ORGANIZER</p><span className="admin-masthead-title">活动管理</span></div>
      <div className="admin-account"><span className="admin-role"><ShieldCheck size={15} />{session.role === 'owner' ? '初始管理员' : '管理员'}</span><PortalAccount /></div>
    </div>
    <nav className="admin-navigation" aria-label="管理后台导航">
      {items.map(({ to, label, icon: Icon }) => <Link key={to} to={to} search={to === '/portal/admin/participants' ? { view: 'pending' } : undefined}
        className="admin-nav-link" aria-current={currentPath === to || currentPath.startsWith(`${to}/`) ? 'page' : undefined}><Icon size={17} strokeWidth={1.5} />{label}</Link>)}
      {session.role === 'owner' ? <Link to="/portal/admin/settings/admins" className="admin-nav-link" aria-current={currentPath === '/portal/admin/settings/admins' ? 'page' : undefined}><UserCog size={17} strokeWidth={1.5} />管理员权限</Link> : null}
    </nav>
    <main id="main-content" className="admin-content" aria-busy={pending}>{children}</main>
    <SiteFooter />
  </div>;
}
