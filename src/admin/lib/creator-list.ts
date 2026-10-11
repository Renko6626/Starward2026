import type { AdminParticipantItem, AdminSegmentItem } from "../../shared/admin";
import type { ApplicationListItem } from "../../shared/applications";

export type CreatorRow = { key: string; participant: AdminParticipantItem | null; application: ApplicationListItem | null };
export type CreatorFilter = "pending" | "all" | "unassigned";

export function buildCreatorRows(participants: AdminParticipantItem[], applications: ApplicationListItem[]): CreatorRow[] {
  const byId = new Map(applications.map(item => [item.id, item]));
  const linked = new Set<string>();
  const rows = participants.map(participant => {
    const application = (participant.applicationId ? byId.get(participant.applicationId) : undefined) ?? null;
    if (application) linked.add(application.id);
    return { key: participant.id, participant, application };
  });
  return [...rows, ...applications.filter(item => !linked.has(item.id)).map(application => ({ key: application.id, participant: null, application }))];
}

export function filterCreatorRows(rows: CreatorRow[], filter: CreatorFilter, query: string) {
  const term = query.trim().toLowerCase();
  return rows.filter(({ participant, application }) => {
    if (filter === "unassigned" && (participant?.status !== "approved" || participant.currentSegmentCode)) return false;
    if (filter === "pending" && application?.status !== "pending") return false;
    return [participant?.displayName, participant?.inviteEmail, participant?.contactHandle, participant?.currentSegmentCode,
      application?.displayName, application?.contactEmail, application?.authUserEmail, application?.contactHandle].join("\n").toLowerCase().includes(term);
  });
}

export function summarizeSchedule(items: (Pick<AdminSegmentItem, "status" | "currentParticipantId"> & Partial<Pick<AdminSegmentItem, "kind">>)[]) {
  return {
    total: items.length,
    open: items.filter(item => item.kind !== "special" && ["open", "released"].includes(item.status) && !item.currentParticipantId).length,
    held: items.filter(item => item.status === "held").length,
    completed: items.filter(item => item.status === "completed").length,
  };
}
