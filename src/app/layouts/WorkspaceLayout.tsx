import { ArchiveBackground } from "../../portal/components/ArchiveBackground";
import { useState, type PropsWithChildren } from "react";
import { useLocation, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { SiteHeader, SiteFooter } from "./SiteLayout";
import { authClient } from "../../portal/lib/auth-client";

export function WorkspaceLayout({ children }: PropsWithChildren<{ kind: "portal" }>) {
  const pending = useRouterState({ select: state => state.isLoading || state.isTransitioning });
  const { pathname } = useLocation();
  const archive = pathname === "/portal" || pathname === "/portal/";
  return <div className={`creator-shell${archive ? " author-archive-shell" : ""}`}>
    {archive ? <ArchiveBackground /> : null}
    <a className="skip-link" href="#main-content">跳至正文</a>
    <SiteHeader />
    <main id="main-content" className="creator-content" aria-busy={pending}>{children}</main>
    <SiteFooter />
  </div>;
}

export function PortalAccount() {
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
