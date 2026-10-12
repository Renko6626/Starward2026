import { Outlet, createFileRoute } from "@tanstack/react-router";
import { validateCreatorSearch } from "../../../../admin/lib/creator-list";

export const Route = createFileRoute("/portal_/admin/participants")({
  validateSearch: validateCreatorSearch,
  component: AdminParticipantsOutlet,
});

function AdminParticipantsOutlet() {
  return <Outlet />;
}
