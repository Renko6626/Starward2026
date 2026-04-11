import type { ParticipantPortalStatus } from "../../src/shared/portal";
import { createPrefixedId } from "../lib/ids";
import { nowIso } from "../lib/time";

export type ParticipantAuthRow = {
  id: string;
  user_id: string | null;
  invite_email: string;
  display_name: string;
  contact_handle: string | null;
  status: ParticipantPortalStatus;
  activated_at: string | null;
  updated_at: string;
  current_segment_code: string | null;
  current_segment_name: string | null;
};

export type ParticipantLinkResult =
  | { kind: "linked"; participantId: string; activated: boolean }
  | { kind: "missing" }
  | { kind: "withdrawn"; participantId: string }
  | { kind: "conflict"; participantId: string };

export function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase();
}

export function isParticipantPortalEligible(status: ParticipantPortalStatus) {
  return status === "invited" || status === "active" || status === "completed";
}

export async function getParticipantByInviteEmail(db: D1Database, email: string) {
  const normalizedEmail = normalizeEmailAddress(email);

  return db
    .prepare(
      `SELECT
        participants.id,
        participants.user_id,
        participants.invite_email,
        participants.display_name,
        participants.contact_handle,
        participants.status,
        participants.activated_at,
        participants.updated_at,
        schedule_segments.code AS current_segment_code,
        schedule_segments.name AS current_segment_name
      FROM participants
      LEFT JOIN schedule_segments
        ON schedule_segments.current_participant_id = participants.id
       AND schedule_segments.status = 'held'
       AND schedule_segments.schedule_version_id = (
         SELECT id
         FROM schedule_versions
         WHERE status = 'active'
         LIMIT 1
       )
      WHERE lower(participants.invite_email) = lower(?)
      LIMIT 1`,
    )
    .bind(normalizedEmail)
    .first<ParticipantAuthRow>();
}

export async function getParticipantByUserId(db: D1Database, userId: string) {
  return db
    .prepare(
      `SELECT
        participants.id,
        participants.user_id,
        participants.invite_email,
        participants.display_name,
        participants.contact_handle,
        participants.status,
        participants.activated_at,
        participants.updated_at,
        schedule_segments.code AS current_segment_code,
        schedule_segments.name AS current_segment_name
      FROM participants
      LEFT JOIN schedule_segments
        ON schedule_segments.current_participant_id = participants.id
       AND schedule_segments.status = 'held'
       AND schedule_segments.schedule_version_id = (
         SELECT id
         FROM schedule_versions
         WHERE status = 'active'
         LIMIT 1
       )
      WHERE participants.user_id = ?
      LIMIT 1`,
    )
    .bind(userId)
    .first<ParticipantAuthRow>();
}

export async function linkParticipantToAuthUser(
  db: D1Database,
  input: {
    email: string;
    userId: string;
  },
): Promise<ParticipantLinkResult> {
  const participant = await getParticipantByInviteEmail(db, input.email);

  if (!participant) {
    return { kind: "missing" };
  }

  if (participant.status === "withdrawn") {
    return { kind: "withdrawn", participantId: participant.id };
  }

  if (participant.user_id && participant.user_id !== input.userId) {
    return { kind: "conflict", participantId: participant.id };
  }

  const now = nowIso();
  const activated = !participant.activated_at || !participant.user_id;
  const nextStatus = participant.status === "invited" ? "active" : participant.status;
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE participants
         SET user_id = COALESCE(user_id, ?),
             status = ?,
             activated_at = COALESCE(activated_at, ?),
             updated_at = ?
         WHERE id = ?`,
      )
      .bind(input.userId, nextStatus, now, now, participant.id),
  ];

  if (activated) {
    statements.push(
      db
        .prepare(
          `INSERT INTO participant_events (
            id,
            participant_id,
            actor_type,
            actor_id,
            event_type,
            target_type,
            target_id,
            payload_json,
            created_at
          ) VALUES (?, ?, 'system', ?, 'portal_activated', 'participant', ?, ?, ?)`,
        )
        .bind(
          createPrefixedId("pevt"),
          participant.id,
          input.userId,
          participant.id,
          JSON.stringify({
            email: normalizeEmailAddress(input.email),
            nextStatus,
          }),
          now,
        ),
    );
  }

  await db.batch(statements);

  return {
    kind: "linked",
    participantId: participant.id,
    activated,
  };
}
