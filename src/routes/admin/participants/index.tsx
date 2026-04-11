import { createFileRoute } from "@tanstack/react-router";
import { AdminParticipantsPage } from "../../../admin/pages/AdminParticipantsPage";

export const Route = createFileRoute("/admin/participants/")({
  component: AdminParticipantsPage,
});
