import type {
  AdminParticipantDetail,
  AdminParticipantItem,
  AdminProjectDraftItem,
  AdminSegmentItem,
  BootstrapSegmentsInput,
  UpdateSegmentInput,
  UpdateParticipantInput,
} from "../../src/shared/admin";
import type { ParticipantPortalStatus, PortalSegmentStatus } from "../../src/shared/portal";
import { resolveParticipantStatusForAdminUpdate } from "../lib/participant-admin";
import { resolveAdminSegmentState } from "../lib/segment-admin";
import { buildInitialScheduleSegments } from "../lib/schedule-bootstrap";
import { createPrefixedId } from "../lib/ids";
import { normalizeOptionalText } from "../lib/strings";
import { nowIso } from "../lib/time";

type ParticipantRow = {
  id: string;
  user_id: string | null;
  display_name: string;
  invite_email: string;
  contact_handle: string | null;
  status: "invited" | "active" | "withdrawn" | "completed";
  application_id: string | null;
  current_segment_code: string | null;
  current_segment_name: string | null;
  invited_at: string | null;
  activated_at: string | null;
  updated_at: string;
};

type SegmentRow = {
  id: string;
  schedule_version_id?: string;
  code: string;
  name: string;
  description: string | null;
  status: PortalSegmentStatus;
  current_participant_id: string | null;
  current_participant_name: string | null;
  claimed_at: string | null;
  released_at: string | null;
  sort_order: number;
  updated_at: string;
};

type ParticipantSegmentAssignmentRow = {
  id: string;
  display_name: string;
  status: ParticipantPortalStatus;
};

type ProjectDraftRow = {
  id: string;
  participant_id: string;
  participant_name: string;
  segment_code: string | null;
  preview_status: "not_started" | "draft" | "submitted" | "changes_requested" | "approved";
  review_status: "not_started" | "draft" | "submitted" | "changes_requested" | "approved";
  preview_title: string | null;
  public_author_name: string | null;
  updated_at: string;
};

type ActiveScheduleVersionRow = {
  id: string;
};

type CountRow = {
  count: number;
};

type SegmentAdminMutationRow = {
  incoming_released_count: number;
  target_updated_count: number;
};

export type BootstrapActiveScheduleSegmentsResult =
  | {
      ok: true;
      items: AdminSegmentItem[];
      message: string;
    }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
    };

export type UpdateActiveScheduleSegmentResult =
  | {
      ok: true;
      item: AdminSegmentItem;
      message: string;
    }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
    };

type ParticipantAdminUpdateRow = {
  id: string;
  user_id: string | null;
  display_name: string;
  contact_handle: string | null;
  status: "invited" | "active" | "withdrawn" | "completed";
  activated_at: string | null;
};

export async function listParticipants(db: D1Database): Promise<AdminParticipantItem[]> {
  const result = await db
    .prepare(
      `SELECT
        participants.id,
        participants.user_id,
        participants.display_name,
        participants.invite_email,
        participants.contact_handle,
        participants.status,
        participants.application_id,
        schedule_segments.code AS current_segment_code,
        schedule_segments.name AS current_segment_name,
        participants.invited_at,
        participants.activated_at,
        participants.updated_at
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
      ORDER BY participants.created_at DESC`,
    )
    .all<ParticipantRow>();

  return (result.results ?? []).map(mapAdminParticipantItem);
}

export async function getParticipantDetail(
  db: D1Database,
  participantId: string,
): Promise<AdminParticipantDetail | null> {
  const row = await db
    .prepare(
      `SELECT
        participants.id,
        participants.user_id,
        participants.display_name,
        participants.invite_email,
        participants.contact_handle,
        participants.status,
        participants.application_id,
        schedule_segments.code AS current_segment_code,
        schedule_segments.name AS current_segment_name,
        participants.invited_at,
        participants.activated_at,
        participants.updated_at
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
      WHERE participants.id = ?
      LIMIT 1`,
    )
    .bind(participantId)
    .first<ParticipantRow>();

  return row ? mapAdminParticipantDetail(row) : null;
}

export async function updateParticipant(
  db: D1Database,
  participantId: string,
  input: UpdateParticipantInput,
  updatedBy: string,
): Promise<AdminParticipantDetail | null> {
  const existing = await db
    .prepare(
      `SELECT
        id,
        user_id,
        display_name,
        contact_handle,
        status,
        activated_at
      FROM participants
      WHERE id = ?
      LIMIT 1`,
    )
    .bind(participantId)
    .first<ParticipantAdminUpdateRow>();

  if (!existing) {
    return null;
  }

  const nextDisplayName = input.displayName.trim();
  const nextContactHandle = normalizeOptionalText(input.contactHandle);
  const nextStatus = resolveParticipantStatusForAdminUpdate({
    requestedStatus: input.status,
    hasActivatedPortal: Boolean(existing.user_id || existing.activated_at),
  });

  const hasChanges =
    existing.display_name !== nextDisplayName ||
    existing.contact_handle !== nextContactHandle ||
    existing.status !== nextStatus;

  if (!hasChanges) {
    return getParticipantDetail(db, participantId);
  }

  const now = nowIso();

  await db.batch([
    db
      .prepare(
        `UPDATE participants
         SET display_name = ?,
             contact_handle = ?,
             status = ?,
             updated_at = ?
         WHERE id = ?`,
      )
      .bind(nextDisplayName, nextContactHandle, nextStatus, now, participantId),
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
        ) VALUES (?, ?, 'admin', ?, 'participant_updated', 'participant', ?, ?, ?)`,
      )
      .bind(
        createPrefixedId("pevt"),
        participantId,
        updatedBy,
        participantId,
        JSON.stringify({
          previousStatus: existing.status,
          nextStatus,
          previousDisplayName: existing.display_name,
          nextDisplayName,
          previousContactHandle: existing.contact_handle,
          nextContactHandle,
        }),
        now,
      ),
  ]);

  return getParticipantDetail(db, participantId);
}

export async function recordParticipantInviteSent(
  db: D1Database,
  input: {
    participantId: string;
    actorId: string;
    portalLoginUrl: string;
  },
) {
  const now = nowIso();

  await db
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
      ) VALUES (?, ?, 'admin', ?, 'portal_invite_sent', 'participant', ?, ?, ?)`,
    )
    .bind(
      createPrefixedId("pevt"),
      input.participantId,
      input.actorId,
      input.participantId,
      JSON.stringify({
        portalLoginUrl: input.portalLoginUrl,
      }),
      now,
    )
    .run();
}

export async function listSegments(db: D1Database): Promise<AdminSegmentItem[]> {
  const result = await db
    .prepare(
      `SELECT
        schedule_segments.id,
        schedule_segments.code,
        schedule_segments.name,
        schedule_segments.description,
        schedule_segments.status,
        schedule_segments.current_participant_id,
        participants.display_name AS current_participant_name,
        schedule_segments.claimed_at,
        schedule_segments.released_at,
        schedule_segments.sort_order,
        schedule_segments.updated_at
      FROM schedule_segments
      INNER JOIN schedule_versions
        ON schedule_versions.id = schedule_segments.schedule_version_id
       AND schedule_versions.status = 'active'
      LEFT JOIN participants ON participants.id = schedule_segments.current_participant_id
      ORDER BY schedule_segments.sort_order ASC, schedule_segments.created_at ASC`,
    )
    .all<SegmentRow>();

  return (result.results ?? []).map(mapAdminSegmentItem);
}

export async function bootstrapActiveScheduleSegments(
  db: D1Database,
  input: BootstrapSegmentsInput,
): Promise<BootstrapActiveScheduleSegmentsResult> {
  const scheduleVersionId = await getActiveScheduleVersionId(db);

  if (!scheduleVersionId) {
    return {
      ok: false,
      status: 409,
      code: "schedule_missing_active",
      message: "当前没有可初始化的生效排期。",
    };
  }

  const existingSegmentCount = await db
    .prepare(
      `SELECT COUNT(*) AS count
      FROM schedule_segments
      WHERE schedule_version_id = ?`,
    )
    .bind(scheduleVersionId)
    .first<CountRow>();

  if ((existingSegmentCount?.count ?? 0) > 0) {
    return {
      ok: false,
      status: 409,
      code: "schedule_segments_already_initialized",
      message: "当前生效排期已经有时间段，不能重复初始化。",
    };
  }

  const now = nowIso();
  const seeds = buildInitialScheduleSegments(input.count);

  await db.batch(
    seeds.map((segment) =>
      db
        .prepare(
          `INSERT INTO schedule_segments (
            id,
            schedule_version_id,
            code,
            name,
            description,
            status,
            current_participant_id,
            claimed_at,
            released_at,
            sort_order,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?)`,
        )
        .bind(
          createPrefixedId("seg"),
          scheduleVersionId,
          segment.code,
          segment.name,
          segment.description,
          segment.status,
          segment.sortOrder,
          now,
          now,
        ),
    ),
  );

  return {
    ok: true,
    items: await listSegments(db),
    message: `已初始化 ${seeds.length} 个时间段。`,
  };
}

export async function updateActiveScheduleSegment(
  db: D1Database,
  segmentId: string,
  input: UpdateSegmentInput,
  updatedBy: string,
): Promise<UpdateActiveScheduleSegmentResult> {
  const scheduleVersionId = await getActiveScheduleVersionId(db);

  if (!scheduleVersionId) {
    return {
      ok: false,
      status: 409,
      code: "schedule_missing_active",
      message: "当前还没有可调整的生效排期。",
    };
  }

  const existingSegment = await getActiveSegmentDetail(db, segmentId);

  if (!existingSegment) {
    return {
      ok: false,
      status: 404,
      code: "segment_not_found",
      message: "未找到对应时间段。",
    };
  }

  const nextDescription = normalizeOptionalText(input.description);
  const nextRequestedParticipantId = normalizeOptionalText(input.currentParticipantId);
  const now = nowIso();

  let nextResolvedState;

  try {
    nextResolvedState = resolveAdminSegmentState({
      currentStatus: existingSegment.status,
      currentParticipantId: existingSegment.current_participant_id,
      currentClaimedAt: existingSegment.claimed_at,
      nextStatus: input.status,
      nextParticipantId: nextRequestedParticipantId,
      now,
    });
  } catch (error) {
    return {
      ok: false,
      status: 422,
      code: "invalid_request",
      message: error instanceof Error ? error.message : "时间段更新参数不正确。",
    };
  }

  if (nextResolvedState.nextParticipantId) {
    const participant = await getParticipantForHeldSegment(db, nextResolvedState.nextParticipantId);

    if (!participant) {
      return {
        ok: false,
        status: 404,
        code: "participant_not_found",
        message: "未找到要分配的参与者。",
      };
    }

    if (!canAssignParticipantToHeldSegment(participant.status)) {
      return {
        ok: false,
        status: 409,
        code: "segment_participant_locked",
        message: "当前参与者状态不可持有时间段。",
      };
    }
  }

  const hasChanges =
    existingSegment.description !== nextDescription ||
    existingSegment.status !== nextResolvedState.nextStatus ||
    existingSegment.current_participant_id !== nextResolvedState.nextParticipantId ||
    existingSegment.claimed_at !== nextResolvedState.claimedAt ||
    existingSegment.released_at !== nextResolvedState.releasedAt;

  if (!hasChanges) {
    const item = await getAdminSegmentItem(db, existingSegment.id);

    if (!item) {
      return {
        ok: false,
        status: 404,
        code: "segment_not_found",
        message: "未找到对应时间段。",
      };
    }

    return {
      ok: true,
      item,
      message: `时间段 ${item.code} · ${item.name} 没有变更。`,
    };
  }

  try {
    const mutation = await db
      .prepare(
        `WITH target_snapshot AS (
          SELECT id
          FROM schedule_segments
          WHERE id = ?1
            AND schedule_version_id = ?2
            AND updated_at = ?3
          LIMIT 1
        ),
        incoming_current_segment AS (
          SELECT id
          FROM schedule_segments
          WHERE schedule_version_id = ?2
            AND current_participant_id = ?4
            AND status = 'held'
            AND id != ?1
            AND EXISTS (SELECT 1 FROM target_snapshot)
          LIMIT 1
        ),
        incoming_released AS (
          UPDATE schedule_segments
          SET current_participant_id = NULL,
              status = 'released',
              released_at = ?5,
              updated_at = ?5
          WHERE id IN (SELECT id FROM incoming_current_segment)
          RETURNING id
        ),
        target_updated AS (
          UPDATE schedule_segments
          SET description = ?6,
              status = ?7,
              current_participant_id = ?4,
              claimed_at = ?8,
              released_at = ?9,
              updated_at = ?5
          WHERE id = ?1
            AND schedule_version_id = ?2
            AND EXISTS (SELECT 1 FROM target_snapshot)
          RETURNING id
        ),
        previous_draft_cleared AS (
          UPDATE project_drafts
          SET segment_id = NULL,
              updated_at = ?5
          WHERE participant_id = ?10
            AND segment_id = ?1
            AND EXISTS (SELECT 1 FROM target_updated)
            AND ?10 IS NOT NULL
            AND (?10 != ?4 OR ?4 IS NULL)
          RETURNING id
        ),
        incoming_draft_updated AS (
          UPDATE project_drafts
          SET segment_id = ?1,
              updated_at = ?5
          WHERE participant_id = ?4
            AND EXISTS (SELECT 1 FROM target_updated)
            AND ?4 IS NOT NULL
          RETURNING id
        ),
        previous_participant_event AS (
          INSERT INTO participant_events (
            id,
            participant_id,
            actor_type,
            actor_id,
            event_type,
            target_type,
            target_id,
            payload_json,
            created_at
          )
          SELECT ?11, ?10, 'admin', ?12, 'segment_admin_released', 'schedule_segment', ?1, ?13, ?5
          WHERE EXISTS (SELECT 1 FROM target_updated)
            AND ?10 IS NOT NULL
            AND (?10 != ?4 OR ?4 IS NULL)
          RETURNING id
        ),
        incoming_participant_event AS (
          INSERT INTO participant_events (
            id,
            participant_id,
            actor_type,
            actor_id,
            event_type,
            target_type,
            target_id,
            payload_json,
            created_at
          )
          SELECT ?14, ?4, 'admin', ?12, 'segment_admin_assigned', 'schedule_segment', ?1, ?15, ?5
          WHERE EXISTS (SELECT 1 FROM target_updated)
            AND ?4 IS NOT NULL
            AND (?4 != ?10 OR ?16 != 'held')
          RETURNING id
        )
        SELECT
          (SELECT count(*) FROM incoming_released) AS incoming_released_count,
          (SELECT count(*) FROM target_updated) AS target_updated_count`,
      )
      .bind(
        existingSegment.id,
        scheduleVersionId,
        existingSegment.updated_at,
        nextResolvedState.nextParticipantId,
        now,
        nextDescription,
        nextResolvedState.nextStatus,
        nextResolvedState.claimedAt,
        nextResolvedState.releasedAt,
        existingSegment.current_participant_id,
        createPrefixedId("pevt"),
        updatedBy,
        JSON.stringify({
          segmentId: existingSegment.id,
          segmentCode: existingSegment.code,
          segmentName: existingSegment.name,
          previousStatus: existingSegment.status,
          nextStatus: nextResolvedState.nextStatus,
        }),
        createPrefixedId("pevt"),
        JSON.stringify({
          segmentId: existingSegment.id,
          segmentCode: existingSegment.code,
          segmentName: existingSegment.name,
          previousStatus: existingSegment.status,
          nextStatus: nextResolvedState.nextStatus,
          previousParticipantId: existingSegment.current_participant_id,
          nextParticipantId: nextResolvedState.nextParticipantId,
        }),
        existingSegment.status,
      )
      .first<SegmentAdminMutationRow>();

    if ((mutation?.target_updated_count ?? 0) !== 1) {
      return {
        ok: false,
        status: 409,
        code: "segment_state_changed",
        message: "时间段状态刚刚发生变化，请刷新后重试。",
      };
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("constraint failed")) {
      return {
        ok: false,
        status: 409,
        code: "segment_state_changed",
        message: "时间段状态刚刚发生变化，请刷新后重试。",
      };
    }

    throw error;
  }

  const item = await getAdminSegmentItem(db, segmentId);

  if (!item) {
    return {
      ok: false,
      status: 404,
      code: "segment_not_found",
      message: "未找到对应时间段。",
    };
  }

  return {
    ok: true,
    item,
    message:
      item.status === "held" && item.currentParticipantName
        ? `已更新 ${item.code} · ${item.name}，当前认领人为 ${item.currentParticipantName}。`
        : `已更新 ${item.code} · ${item.name}。`,
  };
}

export async function listProjectDrafts(db: D1Database): Promise<AdminProjectDraftItem[]> {
  const result = await db
    .prepare(
      `SELECT
        project_drafts.id,
        project_drafts.participant_id,
        participants.display_name AS participant_name,
        schedule_segments.code AS segment_code,
        project_drafts.preview_status,
        project_drafts.review_status,
        project_drafts.preview_title,
        project_drafts.public_author_name,
        project_drafts.updated_at
      FROM project_drafts
      INNER JOIN participants ON participants.id = project_drafts.participant_id
      LEFT JOIN schedule_segments ON schedule_segments.id = project_drafts.segment_id
      ORDER BY project_drafts.updated_at DESC`,
    )
    .all<ProjectDraftRow>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    participantId: row.participant_id,
    participantName: row.participant_name,
    segmentCode: row.segment_code,
    previewStatus: row.preview_status,
    reviewStatus: row.review_status,
    previewTitle: row.preview_title,
    publicAuthorName: row.public_author_name,
    updatedAt: row.updated_at,
  }));
}

async function getActiveScheduleVersionId(db: D1Database) {
  const row = await db
    .prepare(
      `SELECT id
      FROM schedule_versions
      WHERE status = 'active'
      ORDER BY updated_at DESC
      LIMIT 1`,
    )
    .first<ActiveScheduleVersionRow>();

  return row?.id ?? null;
}

async function getActiveSegmentDetail(db: D1Database, segmentId: string) {
  return db
    .prepare(
      `SELECT
        schedule_segments.id,
        schedule_segments.schedule_version_id,
        schedule_segments.code,
        schedule_segments.name,
        schedule_segments.description,
        schedule_segments.status,
        schedule_segments.current_participant_id,
        participants.display_name AS current_participant_name,
        schedule_segments.claimed_at,
        schedule_segments.released_at,
        schedule_segments.sort_order,
        schedule_segments.updated_at
      FROM schedule_segments
      INNER JOIN schedule_versions
        ON schedule_versions.id = schedule_segments.schedule_version_id
       AND schedule_versions.status = 'active'
      LEFT JOIN participants ON participants.id = schedule_segments.current_participant_id
      WHERE schedule_segments.id = ?
      LIMIT 1`,
    )
    .bind(segmentId)
    .first<SegmentRow>();
}

async function getAdminSegmentItem(db: D1Database, segmentId: string) {
  const row = await getActiveSegmentDetail(db, segmentId);
  return row ? mapAdminSegmentItem(row) : null;
}

async function getParticipantForHeldSegment(db: D1Database, participantId: string) {
  return db
    .prepare(
      `SELECT
        id,
        display_name,
        status
      FROM participants
      WHERE id = ?
      LIMIT 1`,
    )
    .bind(participantId)
    .first<ParticipantSegmentAssignmentRow>();
}

function mapAdminParticipantItem(row: ParticipantRow): AdminParticipantItem {
  return {
    id: row.id,
    displayName: row.display_name,
    inviteEmail: row.invite_email,
    contactHandle: row.contact_handle,
    status: row.status,
    applicationId: row.application_id,
    currentSegmentCode: row.current_segment_code,
    updatedAt: row.updated_at,
  };
}

function mapAdminParticipantDetail(row: ParticipantRow): AdminParticipantDetail {
  return {
    ...mapAdminParticipantItem(row),
    userId: row.user_id,
    currentSegmentName: row.current_segment_name,
    invitedAt: row.invited_at,
    activatedAt: row.activated_at,
  };
}

function mapAdminSegmentItem(row: SegmentRow): AdminSegmentItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    status: row.status,
    currentParticipantId: row.current_participant_id,
    currentParticipantName: row.current_participant_name,
    claimedAt: row.claimed_at,
    releasedAt: row.released_at,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
  };
}

function canAssignParticipantToHeldSegment(status: ParticipantPortalStatus) {
  return status === "invited" || status === "active";
}
