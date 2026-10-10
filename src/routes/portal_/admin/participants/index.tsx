import { createFileRoute } from "@tanstack/react-router";
import { AdminParticipantsPage } from "../../../../admin/pages/AdminParticipantsPage";

export const Route = createFileRoute("/portal_/admin/participants/")({
  validateSearch: (search: Record<string, unknown>): { view: "pending" | "all" } => ({ view: search.view === "all" ? "all" : "pending" }),
  component: AdminParticipantsPage,
});
