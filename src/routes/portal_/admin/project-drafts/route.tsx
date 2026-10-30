import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/portal_/admin/project-drafts")({
  validateSearch: (search: Record<string, unknown>): { scope?: import('../../../../admin/pages/AdminProjectDraftsPage').SubmissionScope; q?: string } => ({
    scope: ['all','not-submitted','pending','changes-requested','approved','rejected','updated'].includes(String(search.scope)) ? search.scope as import('../../../../admin/pages/AdminProjectDraftsPage').SubmissionScope : 'all',
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
  component: AdminProjectDraftsOutlet,
});

function AdminProjectDraftsOutlet() {
  return <Outlet />;
}
