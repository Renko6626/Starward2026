import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/project-drafts")({
  component: AdminProjectDraftsOutlet,
});

function AdminProjectDraftsOutlet() {
  return <Outlet />;
}
