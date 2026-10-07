import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/portal/schedule")({
  beforeLoad: () => { throw redirect({ to: "/portal", hash: "schedule", replace: true }); },
});
