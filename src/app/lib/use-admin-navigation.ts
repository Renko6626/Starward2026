import { useEffect, useState } from 'react';
import { authClient } from '../../portal/lib/auth-client';
import type { AdminSession } from '../../shared/admin-access';

export function useAdminNavigation() {
  const { data } = authClient.useSession();
  const userId = data?.user.id;
  const email = data?.user.email.trim().toLowerCase();
  const verified = data?.user.emailVerified;
  const [adminUserId, setAdminUserId] = useState<string>();
  useEffect(() => {
    setAdminUserId(undefined);
    if (!userId || !verified) return;
    const controller = new AbortController();
    let checking = false;
    async function check() {
      if (document.hidden || checking) return;
      checking = true;
      try {
        // A normal user's 403 is expected here and must not trigger navigation.
        const response = await fetch('/api/admin/session', { cache: 'no-store', signal: controller.signal });
        const session: AdminSession | null = response.ok ? await response.json() : null;
        if (!controller.signal.aborted) setAdminUserId(session && session.email?.trim().toLowerCase() === email && ['owner', 'admin'].includes(session.role) ? userId : undefined);
      } catch { if (!controller.signal.aborted) setAdminUserId(undefined); }
      finally { checking = false; }
    }
    const hide = () => setAdminUserId(undefined);
    void check();
    window.addEventListener('focus', check);
    window.addEventListener('admin-access-lost', hide);
    document.addEventListener('visibilitychange', check);
    const timer = window.setInterval(check, 60_000);
    return () => {
      controller.abort(); clearInterval(timer);
      window.removeEventListener('focus', check);
      window.removeEventListener('admin-access-lost', hide);
      document.removeEventListener('visibilitychange', check);
    };
  }, [userId, email, verified]);
  return Boolean(userId && verified && adminUserId === userId);
}
