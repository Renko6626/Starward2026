import type {
  AdminProjectDraftDetail,
  UpdateProjectDraftInput,
} from "../../src/shared/admin";
import type {
  ParticipantPortalStatus,
  PortalProjectDraftDetail,
  ProjectDraftStatus,
  UpdatePortalProjectPreviewInput,
  UpdatePortalProjectReviewInput,
} from "../../src/shared/portal";
import type { EventWindowSummary } from "../../src/shared/windows";
import { resolveAdminProjectDraftReviewUpdate } from "../lib/project-draft-admin";
import {
  collectMissingPreviewSubmissionFields,
  collectMissingReviewSubmissionFields,
  resolvePortalProjectDraftSaveStatus,
} from "../lib/project-draft-portal";
import { createPrefixedId } from "../lib/ids";
import { normalizeOptionalText } from "../lib/strings";
import { nowIso } from "../lib/time";
import { getWindowOrFallback } from "../lib/windows";
import type { ParticipantAuthRow } from "./participants";

type ProjectDraftRow = {
  id: string;
  participant_id: string;
  participant_name: string;
  participant_invite_email: string;
  participant_contact_handle: string | null;
  participant_status: ParticipantPortalStatus;
  segment_code: string | null;
  segment_name: string | null;
  preview_status: ProjectDraftStatus;
  review_status: ProjectDraftStatus;
  preview_title: string | null;
  preview_summary: string | null;
  public_author_name: string | null;
  format_label: string | null;
  public_tags_json: string | null;
  content_note: string | null;
  content_warnings: string | null;
  review_note: string | null;
  admin_feedback: string | null;
  preview_submitted_at: string | null;
  review_submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  updated_at: string;
};

export type UpdateAdminProjectDraftResult =
  | {
      ok: true;
      draft: AdminProjectDraftDetail;
      message: string;
    }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
    };

export type PortalProjectDraftMutationResult =
  | {
      ok: true;
      draft: PortalProjectDraftDetail;
      message: string;
    }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
    };

export async function getAdminProjectDraftDetail(
  db: D1Database,
  draftId: string,
): Promise<AdminProjectDraftDetail | null> {
  const row = await db
    .prepare(projectDraftSelectSql + " WHERE project_drafts.id = ? LIMIT 1")
    .bind(draftId)
    .first<ProjectDraftRow>();

  return row ? mapAdminProjectDraftDetail(row) : null;
}

export async function updateAdminProjectDraftReview(
  db: D1Database,
  draftId: string,
  input: UpdateProjectDraftInput,
  reviewedBy: string,
): Promise<UpdateAdminProjectDraftResult> {
  const existing = await getAdminProjectDraftDetail(db, draftId);

  if (!existing) {
    return {
      ok: false,
      status: 404,
      code: "not_found",
      message: "未找到对应资料。",
    };
  }

  const now = nowIso();
  const resolved = resolveAdminProjectDraftReviewUpdate({
    currentPreviewStatus: existing.previewStatus,
    currentReviewStatus: existing.reviewStatus,
    currentAdminFeedback: existing.adminFeedback,
    currentReviewedAt: existing.reviewedAt,
    currentReviewedBy: existing.reviewedBy,
    nextPreviewStatus: input.previewStatus,
    nextReviewStatus: input.reviewStatus,
    nextAdminFeedback: input.adminFeedback,
    reviewerId: reviewedBy,
    now,
  });

  if (!resolved.hasChanges) {
    return {
      ok: true,
      draft: existing,
      message: `资料 ${existing.participantName} 没有变更。`,
    };
  }

  await db.batch([
    db
      .prepare(
        `UPDATE project_drafts
         SET preview_status = ?,
             review_status = ?,
             admin_feedback = ?,
             reviewed_at = ?,
             reviewed_by = ?,
             updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        resolved.nextPreviewStatus,
        resolved.nextReviewStatus,
        resolved.nextAdminFeedback,
        resolved.reviewedAt,
        resolved.reviewedBy,
        now,
        draftId,
      ),
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
        ) VALUES (?, ?, 'admin', ?, 'project_draft_admin_reviewed', 'project_draft', ?, ?, ?)`,
      )
      .bind(
        createPrefixedId("pevt"),
        existing.participantId,
        reviewedBy,
        draftId,
        JSON.stringify({
          previewStatus: resolved.nextPreviewStatus,
          reviewStatus: resolved.nextReviewStatus,
          hasAdminFeedback: Boolean(resolved.nextAdminFeedback),
        }),
        now,
      ),
  ]);

  const draft = await getAdminProjectDraftDetail(db, draftId);

  if (!draft) {
    return {
      ok: false,
      status: 404,
      code: "not_found",
      message: "未找到对应资料。",
    };
  }

  return {
    ok: true,
    draft,
    message: `已更新 ${draft.participantName} 的资料审核状态。`,
  };
}

export async function getPortalProjectDraftDetail(
  db: D1Database,
  participantId: string,
): Promise<PortalProjectDraftDetail | null> {
  const row = await getOrCreateProjectDraftRow(db, participantId);
  return row ? mapPortalProjectDraftDetail(row) : null;
}

export async function updatePortalProjectPreview(
  db: D1Database,
  input: {
    participant: ParticipantAuthRow;
    data: UpdatePortalProjectPreviewInput;
  },
): Promise<PortalProjectDraftMutationResult> {
  const existing = await getOrCreateProjectDraftRow(db, input.participant.id);

  if (!existing) {
    return projectDraftMutationError(
      404,
      "project_draft_missing",
      "未找到当前作品资料。",
    );
  }

  // An approved preview is terminal for the participant: only an admin requesting
  // changes (status -> changes_requested) reopens it. Without this guard a save
  // silently recomputes the status back to 'draft', un-approving admin-approved
  // work with no window gating.
  if (existing.preview_status === "approved") {
    return projectDraftMutationError(
      409,
      "preview_already_approved",
      "预告资料当前已通过，暂不可修改，如需调整请联系主催。",
    );
  }

  const nextPreviewTitle = normalizeOptionalText(input.data.previewTitle);
  const nextPreviewSummary = normalizeOptionalText(input.data.previewSummary);
  const nextFormatLabel = normalizeOptionalText(input.data.formatLabel);
  const nextPublicTags = normalizePublicTags(input.data.publicTags);
  const nextPreviewStatus = resolvePortalProjectDraftSaveStatus(
    existing.preview_status,
  );

  const hasChanges =
    existing.preview_title !== nextPreviewTitle ||
    existing.preview_summary !== nextPreviewSummary ||
    existing.format_label !== nextFormatLabel ||
    !areStringArraysEqual(
      parsePublicTags(existing.public_tags_json),
      nextPublicTags,
    ) ||
    existing.preview_status !== nextPreviewStatus;

  if (!hasChanges) {
    return {
      ok: true,
      draft: mapPortalProjectDraftDetail(existing),
      message: "预告信息没有变更。",
    };
  }

  const now = nowIso();

  await db.batch([
    db
      .prepare(
        `UPDATE project_drafts
         SET preview_title = ?,
             preview_summary = ?,
             format_label = ?,
             public_tags_json = ?,
             preview_status = ?,
             updated_at = ?
         WHERE participant_id = ?`,
      )
      .bind(
        nextPreviewTitle,
        nextPreviewSummary,
        nextFormatLabel,
        nextPublicTags.length > 0 ? JSON.stringify(nextPublicTags) : null,
        nextPreviewStatus,
        now,
        input.participant.id,
      ),
    buildParticipantEventInsert(db, {
      participantId: input.participant.id,
      actorId: input.participant.id,
      eventType: "project_preview_saved",
      targetId: existing.id,
      payload: {
        previewStatus: nextPreviewStatus,
      },
      now,
    }),
  ]);

  const draft = await getPortalProjectDraftDetail(db, input.participant.id);

  if (!draft) {
    return projectDraftMutationError(
      404,
      "project_draft_missing",
      "未找到当前作品资料。",
    );
  }

  return {
    ok: true,
    draft,
    message: "已保存预告信息草稿。",
  };
}

export async function submitPortalProjectPreview(
  db: D1Database,
  input: {
    participant: ParticipantAuthRow;
    windows: EventWindowSummary[];
  },
): Promise<PortalProjectDraftMutationResult> {
  const window = getWindowOrFallback(input.windows, "preview_submit_open");

  if (!window.isOpen) {
    return projectDraftMutationError(
      403,
      "preview_submit_closed",
      "当前还没有开放预告资料提交。",
    );
  }

  const existing = await getOrCreateProjectDraftRow(db, input.participant.id);

  if (!existing) {
    return projectDraftMutationError(
      404,
      "project_draft_missing",
      "未找到当前作品资料。",
    );
  }

  if (existing.preview_status === "approved") {
    return projectDraftMutationError(
      409,
      "preview_already_approved",
      "预告资料当前已通过，如需修改请先保存新的草稿。",
    );
  }

  const missingFields = collectMissingPreviewSubmissionFields({
    previewTitle: existing.preview_title,
    previewSummary: existing.preview_summary,
    publicAuthorName: existing.public_author_name,
    formatLabel: existing.format_label,
  });

  if (missingFields.length > 0) {
    return projectDraftMutationError(
      409,
      "preview_incomplete",
      `提交预告前请先补全：${missingFields.join("、")}。`,
    );
  }

  if (
    existing.preview_status === "submitted" &&
    existing.preview_submitted_at
  ) {
    return {
      ok: true,
      draft: mapPortalProjectDraftDetail(existing),
      message: "预告资料已经提交，无需重复提交。",
    };
  }

  const now = nowIso();

  await db.batch([
    db
      .prepare(
        `UPDATE project_drafts
         SET preview_status = 'submitted',
             preview_submitted_at = ?,
             updated_at = ?
         WHERE participant_id = ?`,
      )
      .bind(now, now, input.participant.id),
    buildParticipantEventInsert(db, {
      participantId: input.participant.id,
      actorId: input.participant.id,
      eventType: "project_preview_submitted",
      targetId: existing.id,
      payload: {
        previewStatus: "submitted",
      },
      now,
    }),
  ]);

  const draft = await getPortalProjectDraftDetail(db, input.participant.id);

  if (!draft) {
    return projectDraftMutationError(
      404,
      "project_draft_missing",
      "未找到当前作品资料。",
    );
  }

  return {
    ok: true,
    draft,
    message: "已将预告资料提交给主催。",
  };
}

export async function updatePortalProjectReview(
  db: D1Database,
  input: {
    participant: ParticipantAuthRow;
    data: UpdatePortalProjectReviewInput;
  },
): Promise<PortalProjectDraftMutationResult> {
  const existing = await getOrCreateProjectDraftRow(db, input.participant.id);

  if (!existing) {
    return projectDraftMutationError(
      404,
      "project_draft_missing",
      "未找到当前作品资料。",
    );
  }

  // See updatePortalProjectPreview: an approved review must not be silently
  // reverted to 'draft' through the unguarded save path.
  if (existing.review_status === "approved") {
    return projectDraftMutationError(
      409,
      "review_already_approved",
      "审查说明当前已通过，暂不可修改，如需调整请联系主催。",
    );
  }

  const nextContentNote = normalizeOptionalText(input.data.contentNote);
  const nextContentWarnings = normalizeOptionalText(input.data.contentWarnings);
  const nextReviewNote = normalizeOptionalText(input.data.reviewNote);
  const nextReviewStatus = resolvePortalProjectDraftSaveStatus(
    existing.review_status,
  );

  const hasChanges =
    existing.content_note !== nextContentNote ||
    existing.content_warnings !== nextContentWarnings ||
    existing.review_note !== nextReviewNote ||
    existing.review_status !== nextReviewStatus;

  if (!hasChanges) {
    return {
      ok: true,
      draft: mapPortalProjectDraftDetail(existing),
      message: "审查说明没有变更。",
    };
  }

  const now = nowIso();

  await db.batch([
    db
      .prepare(
        `UPDATE project_drafts
         SET content_note = ?,
             content_warnings = ?,
             review_note = ?,
             review_status = ?,
             updated_at = ?
         WHERE participant_id = ?`,
      )
      .bind(
        nextContentNote,
        nextContentWarnings,
        nextReviewNote,
        nextReviewStatus,
        now,
        input.participant.id,
      ),
    buildParticipantEventInsert(db, {
      participantId: input.participant.id,
      actorId: input.participant.id,
      eventType: "project_review_saved",
      targetId: existing.id,
      payload: {
        reviewStatus: nextReviewStatus,
      },
      now,
    }),
  ]);

  const draft = await getPortalProjectDraftDetail(db, input.participant.id);

  if (!draft) {
    return projectDraftMutationError(
      404,
      "project_draft_missing",
      "未找到当前作品资料。",
    );
  }

  return {
    ok: true,
    draft,
    message: "已保存审查说明草稿。",
  };
}

export async function submitPortalProjectReview(
  db: D1Database,
  input: {
    participant: ParticipantAuthRow;
    windows: EventWindowSummary[];
  },
): Promise<PortalProjectDraftMutationResult> {
  const window = getWindowOrFallback(input.windows, "review_submit_open");

  if (!window.isOpen) {
    return projectDraftMutationError(
      403,
      "review_submit_closed",
      "当前还没有开放审查说明提交。",
    );
  }

  const existing = await getOrCreateProjectDraftRow(db, input.participant.id);

  if (!existing) {
    return projectDraftMutationError(
      404,
      "project_draft_missing",
      "未找到当前作品资料。",
    );
  }

  if (existing.review_status === "approved") {
    return projectDraftMutationError(
      409,
      "review_already_approved",
      "审查说明当前已通过，如需修改请先保存新的草稿。",
    );
  }

  const missingFields = collectMissingReviewSubmissionFields({
    contentNote: existing.content_note,
    contentWarnings: existing.content_warnings,
  });

  if (missingFields.length > 0) {
    return projectDraftMutationError(
      409,
      "review_incomplete",
      `提交审查说明前请先补全：${missingFields.join("、")}。`,
    );
  }

  if (existing.review_status === "submitted" && existing.review_submitted_at) {
    return {
      ok: true,
      draft: mapPortalProjectDraftDetail(existing),
      message: "审查说明已经提交，无需重复提交。",
    };
  }

  const now = nowIso();

  await db.batch([
    db
      .prepare(
        `UPDATE project_drafts
         SET review_status = 'submitted',
             review_submitted_at = ?,
             updated_at = ?
         WHERE participant_id = ?`,
      )
      .bind(now, now, input.participant.id),
    buildParticipantEventInsert(db, {
      participantId: input.participant.id,
      actorId: input.participant.id,
      eventType: "project_review_submitted",
      targetId: existing.id,
      payload: {
        reviewStatus: "submitted",
      },
      now,
    }),
  ]);

  const draft = await getPortalProjectDraftDetail(db, input.participant.id);

  if (!draft) {
    return projectDraftMutationError(
      404,
      "project_draft_missing",
      "未找到当前作品资料。",
    );
  }

  return {
    ok: true,
    draft,
    message: "已将审查说明提交给主催。",
  };
}

async function getOrCreateProjectDraftRow(
  db: D1Database,
  participantId: string,
) {
  let row = await db
    .prepare(
      projectDraftSelectSql +
        " WHERE project_drafts.participant_id = ? LIMIT 1",
    )
    .bind(participantId)
    .first<ProjectDraftRow>();

  if (row) {
    return row;
  }

  const now = nowIso();

  await db
    .prepare(
      `INSERT INTO project_drafts (
        id,
        participant_id,
        segment_id,
        preview_status,
        review_status,
        created_at,
        updated_at
      ) VALUES (
        ?,
        ?,
        (
          SELECT schedule_segments.id
          FROM schedule_segments
          INNER JOIN schedule_versions
            ON schedule_versions.id = schedule_segments.schedule_version_id
           AND schedule_versions.status = 'active'
          WHERE schedule_segments.current_participant_id = ?
            AND schedule_segments.status = 'held'
          ORDER BY schedule_segments.updated_at DESC
          LIMIT 1
        ),
        'not_started',
        'not_started',
        ?,
        ?
      )
      ON CONFLICT(participant_id) DO NOTHING`,
    )
    .bind(createPrefixedId("draft"), participantId, participantId, now, now)
    .run();

  row = await db
    .prepare(
      projectDraftSelectSql +
        " WHERE project_drafts.participant_id = ? LIMIT 1",
    )
    .bind(participantId)
    .first<ProjectDraftRow>();

  return row ?? null;
}

function mapAdminProjectDraftDetail(
  row: ProjectDraftRow,
): AdminProjectDraftDetail {
  return {
    id: row.id,
    participantId: row.participant_id,
    participantName: row.participant_name,
    participantInviteEmail: row.participant_invite_email,
    participantContactHandle: row.participant_contact_handle,
    participantStatus: row.participant_status,
    segmentCode: row.segment_code,
    segmentName: row.segment_name,
    previewStatus: row.preview_status,
    reviewStatus: row.review_status,
    previewTitle: row.preview_title,
    previewSummary: row.preview_summary,
    publicAuthorName: row.public_author_name,
    formatLabel: row.format_label,
    publicTags: parsePublicTags(row.public_tags_json),
    contentNote: row.content_note,
    contentWarnings: row.content_warnings,
    reviewNote: row.review_note,
    adminFeedback: row.admin_feedback,
    previewSubmittedAt: row.preview_submitted_at,
    reviewSubmittedAt: row.review_submitted_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    updatedAt: row.updated_at,
  };
}

function mapPortalProjectDraftDetail(
  row: ProjectDraftRow,
): PortalProjectDraftDetail {
  return {
    id: row.id,
    previewStatus: row.preview_status,
    reviewStatus: row.review_status,
    previewTitle: row.preview_title,
    previewSummary: row.preview_summary,
    publicAuthorName: row.public_author_name,
    formatLabel: row.format_label,
    publicTags: parsePublicTags(row.public_tags_json),
    contentNote: row.content_note,
    contentWarnings: row.content_warnings,
    reviewNote: row.review_note,
    adminFeedback: row.admin_feedback,
    previewSubmittedAt: row.preview_submitted_at,
    reviewSubmittedAt: row.review_submitted_at,
    reviewedAt: row.reviewed_at,
    updatedAt: row.updated_at,
  };
}

function buildParticipantEventInsert(
  db: D1Database,
  input: {
    participantId: string;
    actorId: string;
    eventType: string;
    targetId: string;
    payload: Record<string, unknown>;
    now: string;
  },
) {
  return db
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
      ) VALUES (?, ?, 'participant', ?, ?, 'project_draft', ?, ?, ?)`,
    )
    .bind(
      createPrefixedId("pevt"),
      input.participantId,
      input.actorId,
      input.eventType,
      input.targetId,
      JSON.stringify(input.payload),
      input.now,
    );
}

function normalizePublicTags(value: string[] | undefined) {
  const deduped = new Set<string>();

  for (const item of value ?? []) {
    const tag = item.trim();

    if (!tag) {
      continue;
    }

    deduped.add(tag);
  }

  return Array.from(deduped);
}

function parsePublicTags(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function areStringArraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}

function projectDraftMutationError(
  status: number,
  code: string,
  message: string,
): PortalProjectDraftMutationResult {
  return {
    ok: false,
    status,
    code,
    message,
  };
}

const projectDraftSelectSql = `SELECT
  project_drafts.id,
  project_drafts.participant_id,
  COALESCE(portal_profiles.credit_name, '未填写署名') AS participant_name,
  participants.invite_email AS participant_invite_email,
  participants.contact_handle AS participant_contact_handle,
  participants.status AS participant_status,
  schedule_segments.code AS segment_code,
  schedule_segments.name AS segment_name,
  project_drafts.preview_status,
  project_drafts.review_status,
  project_drafts.preview_title,
  project_drafts.preview_summary,
  CASE WHEN portal_profiles.is_anonymous = 1 THEN '匿名' ELSE portal_profiles.credit_name END AS public_author_name,
  project_drafts.format_label,
  project_drafts.public_tags_json,
  project_drafts.content_note,
  project_drafts.content_warnings,
  project_drafts.review_note,
  project_drafts.admin_feedback,
  project_drafts.preview_submitted_at,
  project_drafts.review_submitted_at,
  project_drafts.reviewed_at,
  project_drafts.reviewed_by,
  project_drafts.updated_at
FROM project_drafts
INNER JOIN participants ON participants.id = project_drafts.participant_id
LEFT JOIN portal_profiles ON portal_profiles.user_id = participants.user_id
LEFT JOIN schedule_segments ON schedule_segments.id = project_drafts.segment_id`;
