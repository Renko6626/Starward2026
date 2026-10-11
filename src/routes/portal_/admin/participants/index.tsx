import { createFileRoute } from "@tanstack/react-router";
import { AdminParticipantsPage } from "../../../../admin/pages/AdminParticipantsPage";

export const Route = createFileRoute("/portal_/admin/participants/")({
  validateSearch: (search: Record<string, unknown>): { view: "pending" | "unassigned" | "all" } => ({ view: search.view === "all" ? "all" : search.view === "unassigned" ? "unassigned" : "pending" }),
  component: AdminParticipantsPage,
});
