import { getRealAuthEmail } from "../../src/shared/auth-identity";
import type { ParticipantPortalStatus } from "../../src/shared/portal";
import { createPrefixedId } from "../lib/ids";
import { nowIso } from "../lib/time";

export type ParticipantAuthRow = {
  id: string;
  user_id: string | null;
  invite_email: string | null;
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
  | { kind: "conflict"; participantId: string };

export function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase();
}

export function isParticipantPortalEligible(status: ParticipantPortalStatus) {
  return status === "approved" || status === "completed";
}

export async function getParticipantByInviteEmail(
  db: D1Database,
  email: string,
) {
  const normalizedEmail = normalizeEmailAddress(email);

  return db
    .prepare(
      `SELECT
        participants.id,
        participants.user_id,
        participants.invite_email,
        COALESCE(portal_profiles.credit_name, '未填写署名') AS display_name,
        participants.contact_handle,
        participants.status,
        participants.activated_at,
        participants.updated_at,
        schedule_segments.code AS current_segment_code,
        schedule_segments.name AS current_segment_name
      FROM participants
      LEFT JOIN portal_profiles ON portal_profiles.user_id = participants.user_id
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
        COALESCE(portal_profiles.credit_name, '未填写署名') AS display_name,
        participants.contact_handle,
        participants.status,
        participants.activated_at,
        participants.updated_at,
        schedule_segments.code AS current_segment_code,
        schedule_segments.name AS current_segment_name
      FROM participants
      LEFT JOIN portal_profiles ON portal_profiles.user_id = participants.user_id
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

export async function ensureParticipantForAuthUser(
  db: D1Database,
  input: {
    email: string | null;
    emailVerified?: boolean;
    userId: string;
  },
): Promise<ParticipantLinkResult> {
  const participant =
    (await getParticipantByUserId(db, input.userId)) ??
    (input.email && input.emailVerified === true ? await getParticipantByInviteEmail(db, input.email) : null);

  if (participant?.user_id && participant.user_id !== input.userId) {
    return { kind: "conflict", participantId: participant.id };
  }

  const now = nowIso();
  const normalizedEmail = getRealAuthEmail(input.email);

  if (!participant) {
    const participantId = createPrefixedId("part");

    await db.batch([
      db
        .prepare(
          `INSERT INTO participants (
            id,
            user_id,
            invite_email,
            contact_handle,
            status,
            invited_at,
            activated_at,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, NULL, 'pending', NULL, ?, ?, ?)`,
        )
        .bind(participantId, input.userId, normalizedEmail, now, now, now),
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
          participantId,
          input.userId,
          participantId,
          JSON.stringify({
            email: normalizedEmail,
            activatedAt: now,
          }),
          now,
        ),
    ]);

    return {
      kind: "linked",
      participantId,
      activated: true,
    };
  }

  const activated = !participant.activated_at || !participant.user_id;
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE participants
         SET user_id = COALESCE(user_id, ?),
             activated_at = COALESCE(activated_at, ?),
             updated_at = ?
         WHERE id = ?`,
      )
      .bind(input.userId, now, now, participant.id),
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
            email: normalizedEmail,
            activatedAt: now,
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
