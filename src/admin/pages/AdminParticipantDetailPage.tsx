import { getRouteApi } from "@tanstack/react-router";
import { AdminCreatorDetailPage } from "./AdminCreatorDetailPage";

export function AdminParticipantDetailPage() {
  const { participantId } = getRouteApi("/admin/participants/$participantId").useParams();
  return <AdminCreatorDetailPage key={participantId} participantId={participantId} />;
}
