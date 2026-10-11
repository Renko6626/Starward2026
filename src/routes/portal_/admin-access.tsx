import { createFileRoute } from '@tanstack/react-router';
import { AdminAccessPage } from '../../admin/pages/AdminAccessPage';
import { adminReturnTo } from '../../shared/admin-access';
export const Route = createFileRoute('/portal_/admin-access')({
  validateSearch: search => ({ reason: search.reason === 'forbidden' ? 'forbidden' : 'unavailable', returnTo: adminReturnTo(search.returnTo) ?? '/portal/admin' }),
  component: () => <AdminAccessPage {...Route.useSearch()} />,
});
