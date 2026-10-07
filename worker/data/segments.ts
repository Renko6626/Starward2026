import type {
  PortalAvailableSegmentSummary,
  PortalSegmentMutationResponse,
  PortalSegmentStatus,
  PortalSegmentSummary,
} from "../../src/shared/portal";
import type { EventWindowSummary } from "../../src/shared/windows";
import { createPrefixedId } from "../lib/ids";
import { buildPortalSegmentActions } from "../lib/segment-rules";
import { nowIso } from "../lib/time";
import { getWindowOrFallback } from "../lib/windows";
import type { ParticipantAuthRow } from "./participants";

type SegmentRow = {
  scheduled_at: string | null;
  id: string;
  schedule_version_id: string;
  code: string;
  name: string;
  description: string | null;
  status: PortalSegmentStatus;
  current_participant_id: string | null;
  claimed_at: string | null;
  released_at: string | null;
  sort_order: number;
};

type ActiveScheduleVersionRow = {
  id: string;
};

export type SegmentMutationResult =
  | { ok: true; response: PortalSegmentMutationResponse }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
    };

/**
 * Statements that administratively release any segment a participant currently
 * holds and detach it from their project draft. Used when a participant loses
 * eligibility (application rejected/withdrawn, or admin downgrade) so a held
 * slot is never left owned by an ineligible participant who can no longer
 * release it themselves. Safe to include even when no segment is held — the
 * guarded predicates simply match zero rows.
 */
export function buildParticipantSegmentReleaseStatements(
  db: D1Database,
  participantId: string,
  now: string,
): D1PreparedStatement[] {
  return [
    db
      .prepare(
        `UPDATE schedule_segments
         SET current_participant_id = NULL,
             status = 'released',
             released_at = ?,
             updated_at = ?
         WHERE current_participant_id = ?
           AND status = 'held'`,
      )
      .bind(now, now, participantId),
    db
      .prepare(
        `UPDATE project_drafts
         SET segment_id = NULL,
             updated_at = ?
         WHERE participant_id = ?
           AND segment_id IS NOT NULL`,
      )
      .bind(now, participantId),
  ];
}

export async function getCurrentSegmentForParticipant(
  db: D1Database,
  participantId: string,
): Promise<PortalSegmentSummary | null> {
  const row = await db
    .prepare(
      `SELECT
        schedule_segments.id,
        schedule_segments.schedule_version_id,
        schedule_segments.code,
        schedule_segments.name,
        schedule_segments.description,
        schedule_segments.scheduled_at,
        schedule_segments.status,
        schedule_segments.current_participant_id,
        schedule_segments.claimed_at,
        schedule_segments.released_at,
        schedule_segments.sort_order
      FROM schedule_segments
      INNER JOIN schedule_versions
        ON schedule_versions.id = schedule_segments.schedule_version_id
       AND schedule_versions.status = 'active'
      WHERE schedule_segments.current_participant_id = ?
        AND schedule_segments.status = 'held'
      LIMIT 1`,
    )
    .bind(participantId)
    .first<SegmentRow>();

  return row ? mapPortalSegmentRow(row) : null;
}

export async function listAvailableSegments(
  db: D1Database,
): Promise<PortalAvailableSegmentSummary[]> {
  const result = await db
    .prepare(
      `SELECT
        schedule_segments.id,
        schedule_segments.schedule_version_id,
        schedule_segments.code,
        schedule_segments.name,
        schedule_segments.description,
        schedule_segments.scheduled_at,
        schedule_segments.status,
        schedule_segments.current_participant_id,
        schedule_segments.claimed_at,
        schedule_segments.released_at,
        schedule_segments.sort_order
      FROM schedule_segments
      INNER JOIN schedule_versions
        ON schedule_versions.id = schedule_segments.schedule_version_id
       AND schedule_versions.status = 'active'
      WHERE schedule_segments.current_participant_id IS NULL
        AND schedule_segments.status IN ('open', 'released')
      ORDER BY schedule_segments.sort_order ASC, schedule_segments.created_at ASC`,
    )
    .all<SegmentRow>();

  return (result.results ?? []).map((row) => ({
    ...mapPortalSegmentRow(row),
    isAvailable: true,
  }));
}

export async function getPortalSegmentState(
  db: D1Database,
  input: {
    participant: ParticipantAuthRow;
    windows: EventWindowSummary[];
  },
) {
  const currentSegment = await getCurrentSegmentForParticipant(db, input.participant.id);
  const actions = buildPortalSegmentActions({
    currentSegment,
    windows: input.windows,
  });

  return {
    currentSegment,
    actions,
    windows: input.windows,
  };
}

export async function claimParticipantSegment(
  db: D1Database,
  input: {
    participant: ParticipantAuthRow;
    windows: EventWindowSummary[];
    segmentId: string;
  },
): Promise<SegmentMutationResult> {
  const window = getWindowOrFallback(input.windows, "segment_claim_open");
  const scheduleVersionId = await getActiveScheduleVersionId(db);

  if (!window.isOpen) {
    return segmentMutationError(403, "segment_claim_closed", "当前还没有开放发布时点认领。");
  }

  if (!scheduleVersionId) {
    return segmentMutationError(409, "schedule_missing_active", "当前还没有可认领的生效排期。");
  }

  if (!canParticipantManageSegments(input.participant.status)) {
    return segmentMutationError(403, "segment_participant_locked", "当前参与者状态不可再执行发布时点认领。");
  }

  const currentSegment = await getCurrentSegmentForParticipant(db, input.participant.id);

  if (currentSegment) {
    return segmentMutationError(
      409,
      "segment_already_held",
      `你已经持有 ${currentSegment.code} · ${currentSegment.name}，如需调整请走发布时点变更或释放。`,
    );
  }

  const targetSegment = await getSegmentById(db, {
    scheduleVersionId,
    segmentId: input.segmentId,
  });

  if (!targetSegment) {
    return segmentMutationError(404, "segment_not_found", "未找到对应发布时点。");
  }

  if (!isSegmentAvailable(targetSegment)) {
    return segmentMutationError(
      409,
      "segment_unavailable",
      "这个发布时点刚刚被认领或暂不可用，请刷新后重试。",
    );
  }

  const now = nowIso();
  const mutation = await db.batch([
    db
      .prepare(
        `UPDATE schedule_segments
         SET current_participant_id = ?1,
             status = 'held',
             claimed_at = ?2,
             released_at = NULL,
             updated_at = ?2
         WHERE id = ?3
           AND schedule_version_id = ?6
           AND current_participant_id IS NULL
           AND status IN ('open', 'released')
           AND NOT EXISTS (
             SELECT 1
             FROM schedule_segments
             WHERE schedule_version_id = ?6
               AND current_participant_id = ?1
               AND status = 'held'
           )`,
      )
      .bind(input.participant.id, now, targetSegment.id, createPrefixedId("pevt"), "", scheduleVersionId),
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
        )
        SELECT ?4, ?1, 'participant', ?1, 'segment_claimed', 'schedule_segment', ?3, ?5, ?2
        WHERE EXISTS (
          SELECT 1
          FROM schedule_segments
          WHERE id = ?3
            AND schedule_version_id = ?6
            AND current_participant_id = ?1
            AND status = 'held'
            AND claimed_at = ?2
        )`,
      )
      .bind(
        input.participant.id,
        now,
        targetSegment.id,
        createPrefixedId("pevt"),
        JSON.stringify({
          segmentId: targetSegment.id,
          segmentCode: targetSegment.code,
          segmentName: targetSegment.name,
        }),
        scheduleVersionId,
      ),
    db
      .prepare(
        `UPDATE project_drafts
         SET segment_id = ?3,
             updated_at = ?2
         WHERE participant_id = ?1
           AND EXISTS (
             SELECT 1
             FROM schedule_segments
             WHERE id = ?3
               AND schedule_version_id = ?6
               AND current_participant_id = ?1
               AND status = 'held'
               AND claimed_at = ?2
           )`,
      )
      .bind(input.participant.id, now, targetSegment.id, createPrefixedId("pevt"), "", scheduleVersionId),
  ]);

  if (toChanges(mutation[0]) !== 1) {
    return segmentMutationError(409, "segment_state_changed", "发布时点状态刚刚发生变化，请刷新后重试。");
  }

  const claimedSegment = await getCurrentSegmentForParticipant(db, input.participant.id);

  if (!claimedSegment) {
    return segmentMutationError(409, "segment_state_changed", "发布时点状态刚刚发生变化，请刷新后重试。");
  }

  return {
    ok: true,
    response: {
      ok: true,
      message: `已成功认领 ${claimedSegment.code} · ${claimedSegment.name}。`,
      segment: claimedSegment,
    },
  };
}

export async function changeParticipantSegment(
  db: D1Database,
  input: {
    participant: ParticipantAuthRow;
    windows: EventWindowSummary[];
    segmentId: string;
  },
): Promise<SegmentMutationResult> {
  const window = getWindowOrFallback(input.windows, "segment_change_open");
  const scheduleVersionId = await getActiveScheduleVersionId(db);

  if (!window.isOpen) {
    return segmentMutationError(403, "segment_change_closed", "当前还没有开放发布时点变更或释放。");
  }

  if (!scheduleVersionId) {
    return segmentMutationError(409, "schedule_missing_active", "当前还没有可调整的生效排期。");
  }

  if (!canParticipantManageSegments(input.participant.status)) {
    return segmentMutationError(403, "segment_participant_locked", "当前参与者状态不可再执行发布时点变更。");
  }

  const currentSegment = await getCurrentSegmentForParticipant(db, input.participant.id);

  if (!currentSegment) {
    return segmentMutationError(409, "segment_missing_current", "你当前还没有持有发布时点，请先认领。");
  }

  if (currentSegment.id === input.segmentId) {
    return segmentMutationError(409, "segment_same_target", "你已经持有这个发布时点，不需要重复变更。");
  }

  const targetSegment = await getSegmentById(db, {
    scheduleVersionId,
    segmentId: input.segmentId,
  });

  if (!targetSegment) {
    return segmentMutationError(404, "segment_not_found", "未找到对应发布时点。");
  }

  if (!isSegmentAvailable(targetSegment)) {
    return segmentMutationError(
      409,
      "segment_unavailable",
      "目标发布时点刚刚被认领或暂不可用，请刷新后重试。",
    );
  }

  const now = nowIso();
  const mutation = await db.batch([
    db
      .prepare(
        `UPDATE schedule_segments
         SET current_participant_id = NULL,
             status = 'released',
             released_at = ?4,
             updated_at = ?4
         WHERE id = ?1
           AND schedule_version_id = ?5
           AND current_participant_id = ?2
           AND status = 'held'
           AND EXISTS (
             SELECT 1
             FROM schedule_segments
             WHERE id = ?3
               AND schedule_version_id = ?5
               AND current_participant_id IS NULL
               AND status IN ('open', 'released')
           )`,
      )
      .bind(currentSegment.id, input.participant.id, targetSegment.id, now, scheduleVersionId),
    db
      .prepare(
        `UPDATE schedule_segments
         SET current_participant_id = ?2,
             status = 'held',
             claimed_at = ?4,
             released_at = NULL,
             updated_at = ?4
         WHERE id = ?3
           AND schedule_version_id = ?5
           AND current_participant_id IS NULL
           AND status IN ('open', 'released')
           AND EXISTS (
             SELECT 1
             FROM schedule_segments
             WHERE id = ?1
               AND schedule_version_id = ?5
               AND current_participant_id IS NULL
               AND status = 'released'
               AND released_at = ?4
           )`,
      )
      .bind(currentSegment.id, input.participant.id, targetSegment.id, now, scheduleVersionId),
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
        )
        SELECT ?6, ?2, 'participant', ?2, 'segment_changed', 'schedule_segment', ?3, ?7, ?4
        WHERE EXISTS (
          SELECT 1
          FROM schedule_segments
          WHERE id = ?3
            AND schedule_version_id = ?5
            AND current_participant_id = ?2
            AND status = 'held'
            AND claimed_at = ?4
        )`,
      )
      .bind(
        currentSegment.id,
        input.participant.id,
        targetSegment.id,
        now,
        scheduleVersionId,
        createPrefixedId("pevt"),
        JSON.stringify({
          fromSegmentId: currentSegment.id,
          fromSegmentCode: currentSegment.code,
          fromSegmentName: currentSegment.name,
          toSegmentId: targetSegment.id,
          toSegmentCode: targetSegment.code,
          toSegmentName: targetSegment.name,
        }),
      ),
    db
      .prepare(
        `UPDATE project_drafts
         SET segment_id = ?3,
             updated_at = ?4
         WHERE participant_id = ?2
           AND EXISTS (
             SELECT 1
             FROM schedule_segments
             WHERE id = ?3
               AND schedule_version_id = ?5
               AND current_participant_id = ?2
               AND status = 'held'
               AND claimed_at = ?4
           )`,
      )
      .bind(currentSegment.id, input.participant.id, targetSegment.id, now, scheduleVersionId),
  ]);

  if (toChanges(mutation[0]) !== 1 || toChanges(mutation[1]) !== 1) {
    return segmentMutationError(409, "segment_state_changed", "发布时点状态刚刚发生变化，请刷新后重试。");
  }

  const nextSegment = await getCurrentSegmentForParticipant(db, input.participant.id);

  if (!nextSegment) {
    return segmentMutationError(409, "segment_state_changed", "发布时点状态刚刚发生变化，请刷新后重试。");
  }

  return {
    ok: true,
    response: {
      ok: true,
      message: `已将当前发布时点调整为 ${nextSegment.code} · ${nextSegment.name}。`,
      segment: nextSegment,
    },
  };
}

export async function releaseParticipantSegment(
  db: D1Database,
  input: {
    participant: ParticipantAuthRow;
    windows: EventWindowSummary[];
  },
): Promise<SegmentMutationResult> {
  const window = getWindowOrFallback(input.windows, "segment_change_open");

  if (!window.isOpen) {
    return segmentMutationError(403, "segment_release_closed", "当前还没有开放发布时点变更或释放。");
  }

  if (!canParticipantManageSegments(input.participant.status)) {
    return segmentMutationError(403, "segment_participant_locked", "当前参与者状态不可再执行发布时点释放。");
  }

  const currentSegment = await getCurrentSegmentForParticipant(db, input.participant.id);

  if (!currentSegment) {
    return segmentMutationError(409, "segment_missing_current", "你当前没有可释放的发布时点。");
  }

  const now = nowIso();
  const mutation = await db.batch([
    db
      .prepare(
        `UPDATE schedule_segments
         SET current_participant_id = NULL,
             status = 'released',
             released_at = ?3,
             updated_at = ?3
         WHERE id = ?1
           AND current_participant_id = ?2
           AND status = 'held'`,
      )
      .bind(currentSegment.id, input.participant.id, now),
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
        )
        SELECT ?4, ?2, 'participant', ?2, 'segment_released', 'schedule_segment', ?1, ?5, ?3
        WHERE EXISTS (
          SELECT 1
          FROM schedule_segments
          WHERE id = ?1
            AND current_participant_id IS NULL
            AND status = 'released'
            AND released_at = ?3
        )`,
      )
      .bind(
        currentSegment.id,
        input.participant.id,
        now,
        createPrefixedId("pevt"),
        JSON.stringify({
          segmentId: currentSegment.id,
          segmentCode: currentSegment.code,
          segmentName: currentSegment.name,
        }),
      ),
    db
      .prepare(
        `UPDATE project_drafts
         SET segment_id = NULL,
             updated_at = ?3
         WHERE participant_id = ?2
           AND EXISTS (
             SELECT 1
             FROM schedule_segments
             WHERE id = ?1
               AND current_participant_id IS NULL
               AND status = 'released'
               AND released_at = ?3
           )`,
      )
      .bind(currentSegment.id, input.participant.id, now),
  ]);

  if (toChanges(mutation[0]) !== 1) {
    return segmentMutationError(409, "segment_state_changed", "发布时点状态刚刚发生变化，请刷新后重试。");
  }

  return {
    ok: true,
    response: {
      ok: true,
      message: `已释放 ${currentSegment.code} · ${currentSegment.name} 这个发布时点。`,
      segment: null,
    },
  };
}

function canParticipantManageSegments(status: ParticipantAuthRow["status"]) {
  return status === "approved";
}

function isSegmentAvailable(segment: SegmentRow) {
  return (
    segment.current_participant_id === null &&
    (segment.status === "open" || segment.status === "released")
  );
}

function mapPortalSegmentRow(row: SegmentRow): PortalSegmentSummary {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    scheduledAt: row.scheduled_at,
    status: row.status,
    claimedAt: row.claimed_at,
    releasedAt: row.released_at,
    sortOrder: row.sort_order,
  };
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

async function getSegmentById(
  db: D1Database,
  input: {
    scheduleVersionId: string;
    segmentId: string;
  },
) {
  return db
    .prepare(
      `SELECT
        id,
        schedule_version_id,
        code,
        name,
        description,
        scheduled_at,
        status,
        current_participant_id,
        claimed_at,
        released_at,
        sort_order
      FROM schedule_segments
      WHERE id = ?
        AND schedule_version_id = ?
      LIMIT 1`,
    )
    .bind(input.segmentId, input.scheduleVersionId)
    .first<SegmentRow>();
}

function segmentMutationError(status: number, code: string, message: string): SegmentMutationResult {
  return {
    ok: false,
    status,
    code,
    message,
  };
}

function toChanges(result: { meta?: { changes?: number } } | null | undefined) {
  return result?.meta?.changes ?? 0;
}
