import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/portal_/admin/")({
  beforeLoad: () => { throw redirect({ to: "/portal/admin/participants", search: { view: "pending" }, replace: true }); },
});
