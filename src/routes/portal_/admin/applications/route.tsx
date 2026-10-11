import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/portal_/admin/applications")({
  component: AdminApplicationsOutlet,
});

function AdminApplicationsOutlet() {
  return <Outlet />;
}
