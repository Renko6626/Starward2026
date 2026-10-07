import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/portal/history")({
  beforeLoad: () => { throw redirect({ to: "/portal", hash: "history", replace: true }); },
});
