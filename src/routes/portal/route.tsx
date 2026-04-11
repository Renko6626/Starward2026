import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/portal")({
  component: PortalRouteOutlet,
});

function PortalRouteOutlet() {
  return <Outlet />;
}
