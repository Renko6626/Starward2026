import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/portal_/admin/participants")({
  component: AdminParticipantsOutlet,
});

function AdminParticipantsOutlet() {
  return <Outlet />;
}
