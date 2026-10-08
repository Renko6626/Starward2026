import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/portal/schedule")({
  beforeLoad: () => { throw redirect({ to: "/works", search: { q: "", type: "all", view: "gallery" }, replace: true }); },
});
