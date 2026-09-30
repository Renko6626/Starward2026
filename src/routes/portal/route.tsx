import { WorkspaceLayout } from "../../app/layouts/WorkspaceLayout";
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/portal")({
  component: PortalRouteOutlet,
});

function PortalRouteOutlet() {
  return (
    <WorkspaceLayout kind="portal">
      <Outlet />
    </WorkspaceLayout>
  );
}
