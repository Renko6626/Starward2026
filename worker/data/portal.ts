import type {
  PortalAuthUserSummary,
  PortalDashboardResponse,
  PortalEventItem,
  PortalHistoryResponse,
  PortalMeResponse,
  PortalParticipantSummary,
  PortalProjectDraftSummary,
  PortalSegmentSummary,
} from "../../src/shared/portal";
import type { EventWindowSummary } from "../../src/shared/windows";
import { buildPortalEventActorLabel, buildPortalEventLabel } from "../lib/portal-history";
import type { ParticipantAuthRow } from "./participants";
import { getCurrentSegmentForParticipant } from "./segments";

type PortalDraftRow = {
  id: string;
  preview_status: PortalProjectDraftSummary["previewStatus"];
  review_status: PortalProjectDraftSummary["reviewStatus"];
  preview_title: string | null;
  public_author_name: string | null;
  updated_at: string;
};

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
  user: PortalAuthUserSummary,
  participant: ParticipantAuthRow,
): Promise<PortalMeResponse> {
  return {
    user,
    participant: mapPortalParticipant(participant),
  };
}

export async function getPortalDashboard(
  db: D1Database,
  input: {
    user: PortalAuthUserSummary;
    participant: ParticipantAuthRow;
    windows: EventWindowSummary[];
  },
): Promise<PortalDashboardResponse> {
  const projectDraft = await db
    .prepare(
      `SELECT
        id,
        preview_status,
        review_status,
        preview_title,
        public_author_name,
        updated_at
      FROM project_drafts
      WHERE participant_id = ?
      LIMIT 1`,
    )
    .bind(input.participant.id)
    .first<PortalDraftRow>();

  const recentEvents = await db
    .prepare(participantEventSelectSql + " WHERE participant_id = ? ORDER BY created_at DESC LIMIT ?")
    .bind(input.participant.id, 5)
    .all<ParticipantEventRow>();

  const currentSegment: PortalSegmentSummary | null = await getCurrentSegmentForParticipant(
    db,
    input.participant.id,
  );

  return {
    user: input.user,
    participant: mapPortalParticipant(input.participant),
    currentSegment,
    projectDraft: projectDraft
      ? {
          id: projectDraft.id,
          previewStatus: projectDraft.preview_status,
          reviewStatus: projectDraft.review_status,
          previewTitle: projectDraft.preview_title,
          publicAuthorName: projectDraft.public_author_name,
          updatedAt: projectDraft.updated_at,
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
  const events = await db
    .prepare(participantEventSelectSql + " WHERE participant_id = ? ORDER BY created_at DESC LIMIT ?")
    .bind(input.participant.id, 50)
    .all<ParticipantEventRow>();

  return {
    user: input.user,
    participant: mapPortalParticipant(input.participant),
    items: mapPortalEvents(events.results ?? []),
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
