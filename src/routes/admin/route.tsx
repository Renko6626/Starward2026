import { WorkspaceLayout } from "../../app/layouts/WorkspaceLayout";
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  component: AdminRouteOutlet,
});

function AdminRouteOutlet() {
  return (
    <WorkspaceLayout kind="admin">
      <Outlet />
    </WorkspaceLayout>
  );
}
