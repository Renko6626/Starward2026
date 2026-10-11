import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/portal/project")({
  beforeLoad: () => { throw redirect({ to: "/portal", replace: true }); },
});
