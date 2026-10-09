import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminApplicationDetailPage } from "../../../admin/pages/AdminApplicationDetailPage";
import { requestJson } from "../../../app/lib/api";
import type { AdminApplicationDetailResponse } from "../../../shared/applications";
import type { AdminParticipantDetailResponse } from "../../../shared/admin";

export const Route = createFileRoute("/admin/applications/$applicationId")({
  beforeLoad: async ({ params }) => {
    // Unlinked historical applications still use the unified detail component.
    const payload = await requestJson<AdminApplicationDetailResponse>(`/api/admin/applications/${params.applicationId}`).catch(() => null);
    if (payload?.application.participant) {
      const linked = await requestJson<AdminParticipantDetailResponse>(`/api/admin/participants/${payload.application.participant.id}`).catch(() => null);
      // Historical email matches alone must not hide the requested application.
      if (linked?.participant.applicationId === params.applicationId) {
        throw redirect({ to: "/admin/participants/$participantId", params: { participantId: linked.participant.id }, replace: true });
      }
    }
  },
  component: AdminApplicationDetailPage,
});
