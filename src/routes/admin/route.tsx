import { AdminLayout } from '../../admin/components/AdminLayout';
import { AdminAccessPage } from '../../admin/pages/AdminAccessPage';
import { ApiError, requestJson } from '../../app/lib/api';
import type { AdminSession } from '../../shared/admin-access';
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    try {
      const admin = await requestJson<AdminSession>('/api/admin/session', { cache: 'no-store' });
      if (!admin?.email || !['owner', 'admin'].includes(admin.role)) throw new Error('Invalid admin session');
      return { admin };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) throw redirect({ to: '/portal/login', search: { returnTo: location.href }, replace: true });
      throw redirect({ to: '/admin-access', search: { reason: error instanceof ApiError && error.status === 403 ? 'forbidden' : 'unavailable', returnTo: location.href }, replace: true });
    }
  },
  errorComponent: () => <AdminAccessPage reason="unavailable" />,
  component: AdminRouteOutlet,
});

function AdminRouteOutlet() {
  const { admin } = Route.useRouteContext();
  return (
    <AdminLayout session={admin}>
      <Outlet />
    </AdminLayout>
  );
}
