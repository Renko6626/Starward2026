import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/participants")({
  component: AdminParticipantsOutlet,
});

function AdminParticipantsOutlet() {
  return <Outlet />;
}
