import { getRelayPublicationState, type RelayPublicationState } from "../../src/shared/relay-publication";
import { publicHttpsUrlSchema, getWorkPublicationIssues } from "../../src/shared/works";
import type { UpdatePortalProjectPreviewInput } from "../../src/shared/portal";
import { resolvePortalProjectDraftSaveStatus } from "../lib/project-draft-portal";
import { createPrefixedId } from "../lib/ids";
import { nowIso } from "../lib/time";
import type { ParticipantAuthRow } from "./participants";
import { getPortalProjectDraftDetail, type PortalProjectDraftMutationResult } from "./project-drafts";

export async function getPortalReleaseState(db: D1Database, participantId: string): Promise<RelayPublicationState> {
  const row = await db.prepare(`SELECT d.release_confirmed_at AS confirmedAt, s.scheduled_at AS scheduledAt
    FROM project_drafts d
    LEFT JOIN schedule_segments s ON s.current_participant_id = d.participant_id
      AND s.status IN ('held', 'locked', 'completed')
      AND s.schedule_version_id IN (SELECT id FROM schedule_versions WHERE status = 'active')
    WHERE d.participant_id = ? LIMIT 1`).bind(participantId)
    .first<{ confirmedAt: string | null; scheduledAt: string | null }>();
  return getRelayPublicationState(row?.scheduledAt ?? null, row?.confirmedAt ?? null);
}

export async function confirmPortalProjectRelease(
  db: D1Database,
  input: { participant: ParticipantAuthRow; workUrl: string; preview?: UpdatePortalProjectPreviewInput },
): Promise<PortalProjectDraftMutationResult> {
  const fail = (code: string, message: string, status = 409) => ({ ok: false as const, code, message, status });
  const url = publicHttpsUrlSchema.safeParse(input.workUrl);
  if (!url.success) return fail("invalid_work_url", "请填写有效的 HTTPS 作品链接。", 422);
  if (!["approved", "completed"].includes(input.participant.status))
    return fail("release_ineligible", "参与资格审核通过后才能确认发布。", 403);
  const existing = await getPortalProjectDraftDetail(db, input.participant.id);
  if (!existing) return fail("project_draft_missing", "未找到当前作品资料。", 404);
  const release = await getPortalReleaseState(db, input.participant.id);
  if (!existing.releaseConfirmedAt && !release.canConfirm)
    return fail("release_not_today", "首次确认发布仅在约定的北京时间发布当天开放。请查看排期，或联系主催。");
  const data = input.preview;
  const candidate = data ? {
    ...existing,
    previewTitle: data.previewTitle?.trim() || null,
    previewSummary: data.previewSummary?.trim() || null,
    formatLabel: data.formatLabel?.trim() || null,
    workType: data.workType ?? null,
    coverUrl: data.coverUrl?.trim() || null,
    coverAlt: data.coverAlt?.trim() || null,
    publicTags: [...new Set(data.publicTags ?? [])],
    previewStatus: resolvePortalProjectDraftSaveStatus(existing.previewStatus),
    workUrl: url.data,
  } : { ...existing, workUrl: url.data };
  const now = nowIso();
  const first = !existing.releaseConfirmedAt;
  const publish = first && getWorkPublicationIssues(candidate).length === 0;
  const results = await db.batch([
    db.prepare(`UPDATE project_drafts SET
      work_url = ?, release_confirmed_at = COALESCE(release_confirmed_at, ?),
      published_at = CASE WHEN ? AND NOT EXISTS (
        SELECT 1 FROM participant_events e WHERE e.target_id = project_drafts.id AND e.event_type = 'work_unpublished'
      ) THEN COALESCE(published_at, ?) ELSE published_at END,
      preview_title = ?, preview_summary = ?, format_label = ?, work_type = ?,
      cover_url = ?, cover_alt = ?, public_tags_json = ?, preview_status = ?, updated_at = ?
      WHERE id = ? AND updated_at = ? AND release_confirmed_at IS ? AND work_url IS ?
        AND preview_status = ? AND review_status = ?
        AND EXISTS (SELECT 1 FROM participants p WHERE p.id = participant_id AND p.status IN ('approved', 'completed'))
        AND (release_confirmed_at IS NOT NULL OR EXISTS (
          SELECT 1 FROM schedule_segments s JOIN schedule_versions v ON v.id = s.schedule_version_id AND v.status = 'active'
          WHERE s.current_participant_id = participant_id AND s.status IN ('held', 'locked', 'completed')
            AND s.scheduled_at = ? AND date(s.scheduled_at, '+8 hours') = date(?, '+8 hours')
        ))`)
      .bind(url.data, now, publish ? 1 : 0, now,
        candidate.previewTitle, candidate.previewSummary, candidate.formatLabel, candidate.workType,
        candidate.coverUrl, candidate.coverAlt, candidate.publicTags.length ? JSON.stringify(candidate.publicTags) : null,
        candidate.previewStatus, now, existing.id, existing.updatedAt, existing.releaseConfirmedAt,
        existing.workUrl, existing.previewStatus, existing.reviewStatus, release.scheduledAt, now),
    db.prepare(`INSERT INTO participant_events
      (id, participant_id, actor_type, actor_id, event_type, target_type, target_id, payload_json, created_at)
      SELECT ?, ?, 'participant', ?, ?, 'project_draft', ?, '{}', ? WHERE changes() = 1`)
      .bind(createPrefixedId("pevt"), input.participant.id, input.participant.id,
        first ? "work_release_confirmed" : "work_link_updated", existing.id, now),
  ]);
  if (results[0].meta.changes !== 1)
    return fail("release_changed", "排期、参与资格或作品资料已变化，请刷新后重试。");
  await publishConfirmedProjectIfReady(db, existing.id);
  const draft = (await getPortalProjectDraftDetail(db, input.participant.id))!;
  return { ok: true, draft, message: first
    ? draft.publishedAt ? "已确认发布，作品已公开。" : "已确认发布，资料审核通过后将自动公开。"
    : "作品链接已更新，首次发布确认时间保留。" };
}


/** Reevaluate fresh saved data; an explicit admin withdrawal suppresses automatic publication. */
export async function publishConfirmedProjectIfReady(db: D1Database, draftId: string) {
  const row = await db.prepare("SELECT participant_id FROM project_drafts WHERE id = ?")
    .bind(draftId).first<{ participant_id: string }>();
  if (!row) return;
  const draft = await getPortalProjectDraftDetail(db, row.participant_id);
  if (!draft || !draft.releaseConfirmedAt || draft.publishedAt || getWorkPublicationIssues(draft).length) return;
  const now = nowIso();
  await db.batch([
    db.prepare(`UPDATE project_drafts SET published_at = ?, updated_at = ?
      WHERE id = ? AND updated_at = ? AND release_confirmed_at IS ? AND published_at IS NULL
        AND preview_status = 'approved' AND review_status = 'approved'
        AND work_url IS ? AND work_type IS ? AND preview_title IS ? AND preview_summary IS ? AND cover_url IS ?
        AND EXISTS (SELECT 1 FROM participants p WHERE p.id = participant_id AND p.status IN ('approved', 'completed'))
        AND NOT EXISTS (SELECT 1 FROM participant_events e WHERE e.target_id = project_drafts.id AND e.event_type = 'work_unpublished')`)
      .bind(now, now, draft.id, draft.updatedAt, draft.releaseConfirmedAt,
        draft.workUrl, draft.workType, draft.previewTitle, draft.previewSummary, draft.coverUrl),
    db.prepare(`INSERT INTO participant_events
      (id, participant_id, actor_type, actor_id, event_type, target_type, target_id, payload_json, created_at)
      SELECT ?, ?, 'system', 'relay-publication', 'work_auto_published', 'project_draft', ?, '{}', ? WHERE changes() = 1`)
      .bind(createPrefixedId("pevt"), row.participant_id, draftId, now),
  ]);
}
