import { createFileRoute } from "@tanstack/react-router";
import { AdminParticipantsPage } from "../../../admin/pages/AdminParticipantsPage";

export const Route = createFileRoute("/admin/participants/")({
  validateSearch: (search: Record<string, unknown>): { view: "pending" | "all" | "unassigned" } => ({ view: search.view === "all" || search.view === "unassigned" ? search.view : "pending" }),
  component: AdminParticipantsPage,
});
