import { reorderSchedule } from "../lib/schedule-order";
import { getRealAuthEmail } from "../../src/shared/auth-identity";
import type {
  AdminParticipantDetail,
  AdminParticipantItem,
  AdminProjectDraftItem,
  AdminSegmentItem,
  AppendSegmentsInput,
  CreateSegmentInput,
  BootstrapSegmentsInput,
  UpdateSegmentInput,
  UpdateParticipantInput,
} from "../../src/shared/admin";
import type {
  ParticipantPortalStatus,
  PortalSegmentStatus,
} from "../../src/shared/portal";
import { resolveAdminSegmentState } from "../lib/segment-admin";
import { buildInitialScheduleSegments } from "../lib/schedule-bootstrap";
import { createPrefixedId } from "../lib/ids";
import { normalizeOptionalText } from "../lib/strings";
import { nowIso } from "../lib/time";
import { buildParticipantSegmentReleaseStatements } from "./segments";

type ParticipantRow = {
  id: string;
  user_id: string | null;
  display_name: string;
  is_anonymous: number;
  invite_email: string | null;
  contact_handle: string | null;
  status: ParticipantPortalStatus;
  application_id: string | null;
  current_segment_code: string | null;
  current_segment_name: string | null;
  invited_at: string | null;
  activated_at: string | null;
  updated_at: string;
};

type SegmentRow = {
  kind: AdminSegmentItem['kind'];
  scheduled_at: string | null;
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
  status: ParticipantPortalStatus;
};

type ProjectDraftRow = {
  id: string;
  participant_id: string;
  participant_name: string;
  segment_code: string | null;
  preview_status:
    | "not_started"
    | "draft"
    | "submitted"
    | "changes_requested"
    | "approved";
  review_status:
    | "not_started"
    | "draft"
    | "submitted"
    | "changes_requested"
    | "approved";
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
  contact_handle: string | null;
  status: ParticipantPortalStatus;
};

export async function listParticipants(
  db: D1Database,
): Promise<AdminParticipantItem[]> {
  const result = await db
    .prepare(
      `SELECT
        participants.id,
        participants.user_id,
        COALESCE(portal_profiles.credit_name, '未填写署名') AS display_name,
        portal_profiles.is_anonymous,
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
      LEFT JOIN portal_profiles ON portal_profiles.user_id = participants.user_id
      LEFT JOIN schedule_segments
        ON schedule_segments.current_participant_id = participants.id
       AND schedule_segments.status IN ('held','locked','completed')
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
        COALESCE(portal_profiles.credit_name, '未填写署名') AS display_name,
        portal_profiles.is_anonymous,
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
      LEFT JOIN portal_profiles ON portal_profiles.user_id = participants.user_id
      LEFT JOIN schedule_segments
        ON schedule_segments.current_participant_id = participants.id
       AND schedule_segments.status IN ('held','locked','completed')
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
        contact_handle,
        status
      FROM participants
      WHERE id = ?
      LIMIT 1`,
    )
    .bind(participantId)
    .first<ParticipantAdminUpdateRow>();

  if (!existing) {
    return null;
  }

  const nextContactHandle = normalizeOptionalText(input.contactHandle);
  const nextStatus = input.status;

  const hasChanges =
    existing.contact_handle !== nextContactHandle ||
    existing.status !== nextStatus;

  if (!hasChanges) {
    return getParticipantDetail(db, participantId);
  }

  const now = nowIso();

  const statements = [
    db
      .prepare(
        `UPDATE participants
         SET contact_handle = ?,
             status = ?,
             updated_at = ?
         WHERE id = ?`,
      )
      .bind(nextContactHandle, nextStatus, now, participantId),
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
          previousContactHandle: existing.contact_handle,
          nextContactHandle,
        }),
        now,
      ),
  ];

  // Completion retains the author's place in the relay and linked work.
  if (nextStatus === "withdrawn" || (nextStatus === "pending" && existing.status !== "pending")) {
    statements.push(
      ...buildParticipantSegmentReleaseStatements(db, participantId, now),
    );
  }

  await db.batch(statements);

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

export async function listSegments(
  db: D1Database,
): Promise<AdminSegmentItem[]> {
  const result = await db
    .prepare(
      `SELECT
        schedule_segments.id,
        schedule_segments.code,
        schedule_segments.name,
        schedule_segments.description,
        schedule_segments.scheduled_at,
        schedule_segments.kind,
        schedule_segments.status,
        schedule_segments.current_participant_id,
        portal_profiles.credit_name AS current_participant_name,
        schedule_segments.claimed_at,
        schedule_segments.released_at,
        schedule_segments.sort_order,
        schedule_segments.updated_at
      FROM schedule_segments
      INNER JOIN schedule_versions
        ON schedule_versions.id = schedule_segments.schedule_version_id
       AND schedule_versions.status = 'active'
      LEFT JOIN participants ON participants.id = schedule_segments.current_participant_id
      LEFT JOIN portal_profiles ON portal_profiles.user_id = participants.user_id
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
      message: "当前生效排期已经有发布时点，不能重复初始化。",
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
    message: `已初始化 ${seeds.length} 个发布时点。`,
  };
}

export async function createActiveScheduleSegment(db: D1Database, input: CreateSegmentInput): Promise<BootstrapActiveScheduleSegmentsResult> {
  const versionId = await getActiveScheduleVersionId(db);
  if (!versionId) return { ok: false, status: 409, code: "schedule_missing_active", message: "当前没有生效排期。" };
  const now = nowIso();
  const prefix = input.kind === "special" ? "SPECIAL-" : "S-";
  const results = await db.batch([
    db.prepare(`INSERT INTO schedule_segments
      (id,schedule_version_id,kind,code,name,description,scheduled_at,status,sort_order,created_at,updated_at)
      SELECT ?, ?, ?, ? || printf('%02d', COALESCE(MAX(sort_order),0)+1), ?, ?, ?, 'open', COALESCE(MAX(sort_order),0)+1, ?, ?
      FROM schedule_segments WHERE schedule_version_id=?
      HAVING EXISTS (SELECT 1 FROM schedule_versions WHERE id=? AND status='active')`)
      .bind(createPrefixedId("seg"),versionId,input.kind,prefix,input.name,normalizeOptionalText(input.description),new Date(input.scheduledAt).toISOString(),now,now,versionId,versionId),
    ...reorderSchedule(db, versionId),
  ]);
  if (!results[0].meta.changes) return { ok: false, status: 409, code: "schedule_changed", message: "生效排期已变化，请刷新后重试。" };
  return { ok: true, items: await listSegments(db), message: "已新增发布时间。" };
}

export async function appendActiveScheduleSegments(
  db: D1Database,
  input: AppendSegmentsInput,
): Promise<BootstrapActiveScheduleSegmentsResult> {
  const versionId = await getActiveScheduleVersionId(db);
  if (!versionId) return { ok: false, status: 409, code: "schedule_missing_active", message: "当前没有可追加坑位的生效排期。" };
  const now = nowIso();
  // D1 executes this batch atomically. Each insert derives the next code and
  // sort position inside the transaction, so concurrent appends cannot reuse them.
  const results = await db.batch(Array.from({ length: input.count }, () => db.prepare(`
    WITH next AS (
      SELECT COALESCE(MAX(CASE WHEN kind = 'extra' THEN CAST(substr(code, 7) AS INTEGER) END), 0) + 1 AS ordinal,
             COALESCE(MAX(sort_order), 0) + 1 AS position
      FROM schedule_segments WHERE schedule_version_id = ?
    )
    INSERT INTO schedule_segments
      (id, schedule_version_id, kind, code, name, description, scheduled_at, status, sort_order, created_at, updated_at)
    SELECT ?, ?, 'extra', printf('EXTRA-%02d', ordinal), '追加坑位 ' || ordinal, NULL, NULL, 'open', position, ?, ?
    FROM next WHERE EXISTS (SELECT 1 FROM schedule_versions WHERE id = ? AND status = 'active')
  `).bind(versionId, createPrefixedId('seg'), versionId, now, now, versionId)));
  if (!results[0]?.meta.changes) return { ok: false, status: 409, code: 'schedule_changed', message: '生效排期已变化，请刷新后追加。' };
  return { ok: true, items: await listSegments(db), message: `已追加 ${input.count} 个坑位。` };
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
      message: "未找到对应发布时点。",
    };
  }

  if ('mode' in input && input.mode === 'fill-empty-time') {
    if (existingSegment.kind !== 'standard') {
      return { ok: false, status: 422, code: 'extra_slot_has_no_schedule', message: '追加坑位不设置标准排程的发布时间。' };
    }
    // Check emptiness and active version in the write itself. Concurrent claims
    // may change any other column; this operation never writes those columns.
    const result = await db.prepare(`UPDATE schedule_segments
      SET scheduled_at = ?, updated_at = ?
      WHERE id = ? AND schedule_version_id = ? AND kind = 'standard' AND scheduled_at IS NULL
        AND EXISTS (SELECT 1 FROM schedule_versions WHERE id = ? AND status = 'active')
    `).bind(new Date(input.scheduledAt).toISOString(), nowIso(), segmentId, scheduleVersionId, scheduleVersionId).run();
    if (result.meta.changes !== 1) {
      return { ok: false, status: 409, code: 'segment_schedule_changed', message: '该格已有发布时间或生效排期已变化，请重新预览。' };
    }
    const item = await getAdminSegmentItem(db, segmentId);
    if (!item) return { ok: false, status: 404, code: 'segment_not_found', message: '未找到对应发布时点。' };
    return { ok: true, item, message: '已补填发布时间。' };
  }

  const nextScheduledAt = input.scheduledAt === undefined ? existingSegment.scheduled_at : input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null;
  if (existingSegment.kind === 'extra' && nextScheduledAt) {
    return { ok: false, status: 422, code: 'extra_slot_has_no_schedule', message: '追加坑位不设置标准排程的发布时间。' };
  }
  if (existingSegment.kind === "special" && !nextScheduledAt) {
    return { ok: false, status: 422, code: "special_slot_requires_time", message: "特别席位需要明确的发布时间。" };
  }
  const nextDescription = input.description === undefined ? existingSegment.description : normalizeOptionalText(input.description);
  const nextRequestedParticipantId = normalizeOptionalText(
    input.currentParticipantId === undefined ? existingSegment.current_participant_id : input.currentParticipantId,
  );
  const now = new Date(Math.max(Date.now(), Date.parse(existingSegment.updated_at) + 1)).toISOString();

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
      message:
        error instanceof Error ? error.message : "发布时点更新参数不正确。",
    };
  }

  if (nextResolvedState.nextParticipantId) {
    const participant = await getParticipantForHeldSegment(
      db,
      nextResolvedState.nextParticipantId,
    );

    if (!participant) {
      return {
        ok: false,
        status: 404,
        code: "participant_not_found",
        message: "未找到要分配的参与者。",
      };
    }

    if (!canAssignParticipantToHeldSegment(participant.status) && existingSegment.current_participant_id !== nextResolvedState.nextParticipantId) {
      return {
        ok: false,
        status: 409,
        code: "segment_participant_locked",
        message: "当前参与者状态不可持有发布时点。",
      };
    }
  }

  const hasChanges =
    existingSegment.scheduled_at !== nextScheduledAt ||
    existingSegment.description !== nextDescription ||
    existingSegment.status !== nextResolvedState.nextStatus ||
    existingSegment.current_participant_id !==
      nextResolvedState.nextParticipantId ||
    existingSegment.claimed_at !== nextResolvedState.claimedAt ||
    existingSegment.released_at !== nextResolvedState.releasedAt;

  if (!hasChanges) {
    const item = await getAdminSegmentItem(db, existingSegment.id);

    if (!item) {
      return {
        ok: false,
        status: 404,
        code: "segment_not_found",
        message: "未找到对应发布时点。",
      };
    }

    return {
      ok: true,
      item,
      message: `发布时点 ${item.code} · ${item.name} 没有变更。`,
    };
  }

  // D1/SQLite does not support data-modifying statements inside a CTE (that is
  // a Postgres-only extension). The mutation is expressed as an ordered,
  // single-transaction batch instead. Every dependent statement is gated on the
  // same optimistic-lock snapshot (the target segment still carries its
  // original updated_at), and the target row is updated LAST so that snapshot
  // stays valid for the preceding statements. If a concurrent writer already
  // advanced the row, the snapshot guard makes every statement (including the
  // target update) a no-op, so the whole batch leaves the data untouched.
  const targetId = existingSegment.id;
  const prevParticipantId = existingSegment.current_participant_id;
  const nextParticipantId = nextResolvedState.nextParticipantId;
  const snapshotClause =
    "EXISTS (SELECT 1 FROM schedule_segments WHERE id = ? AND schedule_version_id = ? AND updated_at = ? AND EXISTS (SELECT 1 FROM schedule_versions WHERE id = schedule_segments.schedule_version_id AND status = 'active'))";
  const snapshotArgs = [
    targetId,
    scheduleVersionId,
    existingSegment.updated_at,
  ] as const;

  const releasedPayload = JSON.stringify({
    segmentId: existingSegment.id,
    segmentCode: existingSegment.code,
    segmentName: existingSegment.name,
    previousStatus: existingSegment.status,
    nextStatus: nextResolvedState.nextStatus,
  });
  const assignedPayload = JSON.stringify({
    segmentId: existingSegment.id,
    segmentCode: existingSegment.code,
    segmentName: existingSegment.name,
    previousStatus: existingSegment.status,
    nextStatus: nextResolvedState.nextStatus,
    previousParticipantId: existingSegment.current_participant_id,
    nextParticipantId: nextResolvedState.nextParticipantId,
  });

  const releaseIncomingHeldSegment = db
    .prepare(
      `UPDATE schedule_segments
        SET current_participant_id = NULL,
            status = 'released',
            released_at = ?,
            updated_at = ?
        WHERE schedule_version_id = ?
          AND current_participant_id = ?
          AND status IN ('held','locked','completed')
          AND id != ?
          AND ${snapshotClause}`,
    )
    .bind(
      now,
      now,
      scheduleVersionId,
      nextParticipantId,
      targetId,
      ...snapshotArgs,
    );

  const clearPreviousDraft = db
    .prepare(
      `UPDATE project_drafts
        SET segment_id = NULL,
            updated_at = ?
        WHERE participant_id = ?
          AND segment_id = ?
          AND ? IS NOT NULL
          AND (? != ? OR ? IS NULL)
          AND ${snapshotClause}`,
    )
    .bind(
      now,
      prevParticipantId,
      targetId,
      prevParticipantId,
      prevParticipantId,
      nextParticipantId,
      nextParticipantId,
      ...snapshotArgs,
    );

  const linkIncomingDraft = db
    .prepare(
      `UPDATE project_drafts
        SET segment_id = ?,
            updated_at = ?
        WHERE participant_id = ?
          AND ? IS NOT NULL
          AND ${snapshotClause}`,
    )
    .bind(targetId, now, nextParticipantId, nextParticipantId, ...snapshotArgs);

  const recordReleaseEvent = db
    .prepare(
      `INSERT INTO participant_events (
        id, participant_id, actor_type, actor_id, event_type, target_type, target_id, payload_json, created_at
      )
      SELECT ?, ?, 'admin', ?, 'segment_admin_released', 'schedule_segment', ?, ?, ?
      WHERE ? IS NOT NULL
        AND (? != ? OR ? IS NULL)
        AND ${snapshotClause}`,
    )
    .bind(
      createPrefixedId("pevt"),
      prevParticipantId,
      updatedBy,
      targetId,
      releasedPayload,
      now,
      prevParticipantId,
      prevParticipantId,
      nextParticipantId,
      nextParticipantId,
      ...snapshotArgs,
    );

  const recordAssignEvent = db
    .prepare(
      `INSERT INTO participant_events (
        id, participant_id, actor_type, actor_id, event_type, target_type, target_id, payload_json, created_at
      )
      SELECT ?, ?, 'admin', ?, 'segment_admin_assigned', 'schedule_segment', ?, ?, ?
      WHERE ? IS NOT NULL
        AND (? != ? OR ? != 'held')
        AND ${snapshotClause}`,
    )
    .bind(
      createPrefixedId("pevt"),
      nextParticipantId,
      updatedBy,
      targetId,
      assignedPayload,
      now,
      nextParticipantId,
      nextParticipantId,
      prevParticipantId,
      existingSegment.status,
      ...snapshotArgs,
    );

  const updateTarget = db
    .prepare(
      `UPDATE schedule_segments
        SET scheduled_at = ?,
            description = ?,
            status = ?,
            current_participant_id = ?,
            claimed_at = ?,
            released_at = ?,
            updated_at = ?
        WHERE id = ?
          AND schedule_version_id = ?
          AND updated_at = ?
          AND EXISTS (SELECT 1 FROM schedule_versions WHERE id = schedule_segments.schedule_version_id AND status = 'active')`,
    )
    .bind(
      nextScheduledAt,
      nextDescription,
      nextResolvedState.nextStatus,
      nextParticipantId,
      nextResolvedState.claimedAt,
      nextResolvedState.releasedAt,
      now,
      targetId,
      scheduleVersionId,
      existingSegment.updated_at,
    );

  try {
    const results = await db.batch([
      releaseIncomingHeldSegment,
      clearPreviousDraft,
      linkIncomingDraft,
      recordReleaseEvent,
      recordAssignEvent,
      updateTarget,
      ...reorderSchedule(db, scheduleVersionId),
    ]);

    const targetChanges = results[5]?.meta?.changes ?? 0;

    if (targetChanges !== 1) {
      return {
        ok: false,
        status: 409,
        code: "segment_state_changed",
        message: "发布时点状态刚刚发生变化，请刷新后重试。",
      };
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("constraint failed")) {
      return {
        ok: false,
        status: 409,
        code: "segment_state_changed",
        message: "发布时点状态刚刚发生变化，请刷新后重试。",
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
      message: "未找到对应发布时点。",
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

export async function listProjectDrafts(
  db: D1Database,
): Promise<AdminProjectDraftItem[]> {
  const result = await db
    .prepare(
      `SELECT
        project_drafts.id,
        project_drafts.participant_id,
        COALESCE(portal_profiles.credit_name, '未填写署名') AS participant_name,
        schedule_segments.code AS segment_code,
        project_drafts.preview_status,
        project_drafts.review_status,
        project_drafts.preview_title,
        CASE WHEN portal_profiles.is_anonymous = 1 THEN '匿名' ELSE portal_profiles.credit_name END AS public_author_name,
        project_drafts.updated_at
      FROM project_drafts
      INNER JOIN participants ON participants.id = project_drafts.participant_id
      LEFT JOIN portal_profiles ON portal_profiles.user_id = participants.user_id
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
        schedule_segments.scheduled_at,
        schedule_segments.kind,
        schedule_segments.status,
        schedule_segments.current_participant_id,
        portal_profiles.credit_name AS current_participant_name,
        schedule_segments.claimed_at,
        schedule_segments.released_at,
        schedule_segments.sort_order,
        schedule_segments.updated_at
      FROM schedule_segments
      INNER JOIN schedule_versions
        ON schedule_versions.id = schedule_segments.schedule_version_id
       AND schedule_versions.status = 'active'
      LEFT JOIN participants ON participants.id = schedule_segments.current_participant_id
      LEFT JOIN portal_profiles ON portal_profiles.user_id = participants.user_id
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

async function getParticipantForHeldSegment(
  db: D1Database,
  participantId: string,
) {
  return db
    .prepare(
      `SELECT
        id,
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
    isAnonymous: Boolean(row.is_anonymous),
    inviteEmail: getRealAuthEmail(row.invite_email),
    contactHandle: row.contact_handle,
    status: row.status,
    applicationId: row.application_id,
    currentSegmentCode: row.current_segment_code,
    updatedAt: row.updated_at,
  };
}

function mapAdminParticipantDetail(
  row: ParticipantRow,
): AdminParticipantDetail {
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
    kind: row.kind,
    scheduledAt: row.scheduled_at,
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
  return status === "approved";
}
