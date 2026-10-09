import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/applications/")({
  beforeLoad: () => { throw redirect({ to: "/admin/participants", search: { view: "pending" }, replace: true }); },
});
