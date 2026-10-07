import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/portal/profile")({
  beforeLoad: () => { throw redirect({ to: "/portal", hash: "profile", replace: true }); },
});
