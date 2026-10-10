import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/portal_/admin/project-drafts")({
  component: AdminProjectDraftsOutlet,
});

function AdminProjectDraftsOutlet() {
  return <Outlet />;
}
