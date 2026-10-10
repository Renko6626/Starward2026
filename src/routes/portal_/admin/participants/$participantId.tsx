import { createFileRoute } from "@tanstack/react-router";
import { AdminParticipantDetailPage } from "../../../../admin/pages/AdminParticipantDetailPage";

export const Route = createFileRoute("/portal_/admin/participants/$participantId")({
  component: AdminParticipantDetailPage,
});
