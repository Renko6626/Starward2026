import { Outlet, createFileRoute } from "@tanstack/react-router";
import { validateCreatorSearch } from "../../../../admin/lib/creator-list";

export const Route = createFileRoute("/portal_/admin/applications")({
  validateSearch: validateCreatorSearch,
  component: AdminApplicationsOutlet,
});

function AdminApplicationsOutlet() {
  return <Outlet />;
}
