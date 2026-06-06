import type {
  PortalApplicationDetail,
  PortalApplicationSummary,
  PortalAuthUserSummary,
  PortalDashboardResponse,
  PortalEventItem,
  PortalHistoryResponse,
  PortalMeResponse,
  PortalParticipantSummary,
  PortalSegmentSummary,
} from "../../src/shared/portal";
import type { EventWindowSummary } from "../../src/shared/windows";
import { buildPortalEventActorLabel, buildPortalEventLabel } from "../lib/portal-history";
import { getPortalApplicationByUserId } from "./applications";
import { getPortalProjectDraftDetail } from "./project-drafts";
import type { ParticipantAuthRow } from "./participants";
import { getPortalProfileByUserId } from "./portal-profiles";
import { getCurrentSegmentForParticipant } from "./segments";

type ParticipantEventRow = {
  id: string;
  event_type: string;
  actor_type: PortalEventItem["actorType"];
  payload_json: string | null;
  created_at: string;
};

export function mapPortalAuthUser(user: {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}): PortalAuthUserSummary {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
  };
}

export function mapPortalParticipant(participant: ParticipantAuthRow): PortalParticipantSummary {
  return {
    id: participant.id,
    displayName: participant.display_name,
    inviteEmail: participant.invite_email,
    contactHandle: participant.contact_handle,
    status: participant.status,
    activatedAt: participant.activated_at,
    currentSegmentCode: participant.current_segment_code,
    currentSegmentName: participant.current_segment_name,
    updatedAt: participant.updated_at,
  };
}

export async function getPortalMe(
  db: D1Database,
  input: {
    user: PortalAuthUserSummary;
    participant: ParticipantAuthRow | null;
  },
): Promise<PortalMeResponse> {
  const profile = await getPortalProfileByUserId(db, input.user.id);
  const application = await getPortalApplicationByUserId(db, input.user.id);

  return {
    user: input.user,
    participant: input.participant ? mapPortalParticipant(input.participant) : null,
    profile,
    application: application ? mapPortalApplicationSummary(application) : null,
  };
}

export async function getPortalDashboard(
  db: D1Database,
  input: {
    user: PortalAuthUserSummary;
    participant: ParticipantAuthRow | null;
    windows: EventWindowSummary[];
  },
): Promise<PortalDashboardResponse> {
  const base = await getPortalMe(db, {
    user: input.user,
    participant: input.participant,
  });

  if (!input.participant) {
    return {
      ...base,
      currentSegment: null,
      projectDraft: null,
      windows: input.windows,
      recentEvents: [],
    };
  }

  const projectDraft = await getPortalProjectDraftDetail(db, input.participant.id);

  const recentEvents = await db
    .prepare(participantEventSelectSql + " WHERE participant_id = ? ORDER BY created_at DESC LIMIT ?")
    .bind(input.participant.id, 5)
    .all<ParticipantEventRow>();

  const currentSegment: PortalSegmentSummary | null = await getCurrentSegmentForParticipant(
    db,
    input.participant.id,
  );

  return {
    ...base,
    participant: mapPortalParticipant(input.participant),
    currentSegment,
    projectDraft: projectDraft
      ? {
          id: projectDraft.id,
          previewStatus: projectDraft.previewStatus,
          reviewStatus: projectDraft.reviewStatus,
          previewTitle: projectDraft.previewTitle,
          publicAuthorName: projectDraft.publicAuthorName,
          updatedAt: projectDraft.updatedAt,
        }
      : null,
    windows: input.windows,
    recentEvents: mapPortalEvents(recentEvents.results ?? []),
  };
}

export async function getPortalHistory(
  db: D1Database,
  input: {
    user: PortalAuthUserSummary;
    participant: ParticipantAuthRow;
  },
): Promise<PortalHistoryResponse> {
  const base = await getPortalMe(db, input);
  const events = await db
    .prepare(participantEventSelectSql + " WHERE participant_id = ? ORDER BY created_at DESC LIMIT ?")
    .bind(input.participant.id, 50)
    .all<ParticipantEventRow>();

  return {
    ...base,
    participant: mapPortalParticipant(input.participant),
    items: mapPortalEvents(events.results ?? []),
  };
}

function mapPortalApplicationSummary(application: PortalApplicationDetail): PortalApplicationSummary {
  return {
    id: application.id,
    displayName: application.displayName,
    contactEmail: application.contactEmail,
    contactHandle: application.contactHandle,
    interestFormat: application.interestFormat,
    status: application.status,
    updatedAt: application.updatedAt,
    reviewedAt: application.reviewedAt,
  };
}

const participantEventSelectSql = `SELECT
  id,
  event_type,
  actor_type,
  payload_json,
  created_at
FROM participant_events`;

function mapPortalEvents(rows: ParticipantEventRow[]): PortalEventItem[] {
  return rows.map((event) => ({
    id: event.id,
    eventType: event.event_type,
    actorType: event.actor_type,
    actorLabel: buildPortalEventActorLabel(event.actor_type),
    label: buildPortalEventLabel({
      eventType: event.event_type,
      actorType: event.actor_type,
      payloadJson: event.payload_json,
    }),
    createdAt: event.created_at,
  }));
}
