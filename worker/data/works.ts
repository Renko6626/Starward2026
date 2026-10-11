import { getWorkPublicationIssues, type PublicWork, type PublicScheduleEntry, type PublicWorkDetailResponse } from "../../src/shared/works";
import type { UpdateAdminProjectDraftResult } from "./project-drafts";
import { getAdminProjectDraftDetail } from "./project-drafts";
import { listEventWindows } from "./event-windows";
import { getWindowOrFallback } from "../lib/windows";
import { nowIso } from "../lib/time";
import { createPrefixedId } from "../lib/ids";

type PublicWorkRow = Omit<PublicWork, "publicTags" | "observationNumber"> & { tagsJson: string | null };

// Public reads deliberately select only display fields, never review or contact details.
export async function listPublicWorks(db: D1Database): Promise<PublicWork[]> {
  const { results } = await db.prepare(`SELECT
    d.id, d.preview_title AS previewTitle, d.preview_summary AS previewSummary,
    CASE WHEN p.is_anonymous = 1 THEN '匿名' ELSE p.credit_name END AS publicAuthorName,
    d.work_type AS workType, d.format_label AS formatLabel, d.public_tags_json AS tagsJson,
    d.cover_url AS coverUrl, d.cover_alt AS coverAlt, d.work_url AS workUrl,
    d.published_at AS publishedAt, s.code AS segmentCode, s.name AS segmentName
    FROM project_drafts d
    INNER JOIN participants participant ON participant.id = d.participant_id
    INNER JOIN portal_profiles p ON p.user_id = participant.user_id
    LEFT JOIN schedule_segments s ON s.id = d.segment_id
    WHERE d.published_at IS NOT NULL
    ORDER BY s.scheduled_at IS NULL, julianday(s.scheduled_at), s.sort_order IS NULL, s.sort_order, d.published_at, d.id`).all<PublicWorkRow>();
  return results.map(({ tagsJson, ...work }, index) => ({
    ...work, publicTags: tagsJson ? JSON.parse(tagsJson) as string[] : [], observationNumber: index + 1,
  }));
}

export async function getPublicWork(db: D1Database, id: string): Promise<PublicWorkDetailResponse | null> {
  const works = await listPublicWorks(db);
  const index = works.findIndex((work) => work.id === id);
  if (index === -1) return null;
  return { work: works[index], previous: works[index - 1] ?? null, next: works[index + 1] ?? null };
}

export async function setWorkPublication(
  db: D1Database, id: string, publish: boolean, actorId: string,
): Promise<UpdateAdminProjectDraftResult> {
  const existing = await getAdminProjectDraftDetail(db, id);
  if (!existing) return { ok: false, status: 404, code: "not_found", message: "未找到对应作品。" };
  if (Boolean(existing.publishedAt) === publish) {
    return { ok: true, draft: existing, message: publish ? "作品已发布。" : "作品已撤下。" };
  }
  if (publish) {
    const window = getWindowOrFallback(await listEventWindows(db), "public_release_open");
    if (!window.isOpen) return { ok: false, status: 409, code: "release_closed", message: "公开发布窗口尚未开放或已结束。" };
    const issues = getWorkPublicationIssues(existing);
    if (issues.length) return { ok: false, status: 409, code: "work_incomplete", message: issues.join("；") + "。" };
  }
  const now = nowIso();
  const results = await db.batch([
    db.prepare(`UPDATE project_drafts SET published_at = ?, updated_at = ?
      WHERE id = ? AND updated_at = ?`).bind(publish ? now : null, now, id, existing.updatedAt),
    db.prepare(`INSERT INTO participant_events
      (id, participant_id, actor_type, actor_id, event_type, target_type, target_id, payload_json, created_at)
      SELECT ?, ?, 'admin', ?, ?, 'project_draft', ?, '{}', ? WHERE changes() = 1`)
      .bind(createPrefixedId("pevt"), existing.participantId, actorId,
        publish ? "work_published" : "work_unpublished", id, now),
  ]);
  if (results[0].meta.changes !== 1) {
    return { ok: false, status: 409, code: "work_changed", message: "作品资料已更新，请重新加载后操作。" };
  }
  const draft = await getAdminProjectDraftDetail(db, id);
  return { ok: true, draft: draft!, message: publish ? "作品已加入公开观测集。" : "作品已从公开观测集撤下。" };
}

// Public previews contain approved display fields only, never formal work URLs.
export async function listPublicSchedule(db: D1Database, works: PublicWork[]): Promise<PublicScheduleEntry[]> {
  type Row = Omit<PublicScheduleEntry, "preview" | "workId"> & {
    draftId: string | null; previewTitle: string | null; previewSummary: string | null;
    workType: PublicWork["workType"]; coverUrl: string | null; coverAlt: string | null;
  };
  const { results } = await db.prepare(`SELECT s.id, s.kind, s.code, s.name, s.scheduled_at AS scheduledAt,
    CASE
      WHEN s.status IN ('held', 'locked', 'completed') AND participant.id IS NOT NULL THEN 'confirmed'
      WHEN s.status IN ('held','locked') AND s.current_participant_id IS NOT NULL THEN 'reserved'
      WHEN s.current_participant_id IS NULL AND s.status IN ('open', 'released') THEN 'available'
      ELSE 'unavailable'
    END AS status,
    CASE WHEN p.is_anonymous = 1 THEN '匿名' ELSE p.credit_name END AS publicAuthorName,
    CASE WHEN s.status IN ('held', 'locked', 'completed') THEN a.interest_format ELSE NULL END AS interestFormat,
    CASE WHEN s.status IN ('held', 'locked', 'completed') THEN a.intro_text ELSE NULL END AS introText,
    d.id AS draftId, d.preview_title AS previewTitle, d.preview_summary AS previewSummary,
    d.work_type AS workType, d.cover_url AS coverUrl, d.cover_alt AS coverAlt
    FROM schedule_segments s
    JOIN schedule_versions v ON v.id = s.schedule_version_id AND v.status = 'active'
    LEFT JOIN participants participant ON participant.id = s.current_participant_id AND participant.status IN ('approved', 'completed')
    LEFT JOIN portal_profiles p ON p.user_id = participant.user_id
    LEFT JOIN applications a ON a.user_id = participant.user_id AND a.status = 'approved'
    LEFT JOIN project_drafts d ON d.participant_id = participant.id AND d.segment_id = s.id AND d.preview_status = 'approved'
    WHERE s.kind <> 'special'
    ORDER BY s.kind = 'extra', s.scheduled_at IS NULL, julianday(s.scheduled_at), s.sort_order, s.id`).all<Row>();
  return results.map(({ draftId, previewTitle, previewSummary, workType, coverUrl, coverAlt, ...entry }) => ({
    ...entry,
    preview: draftId ? { previewTitle, previewSummary, workType, coverUrl, coverAlt } : null,
    workId: works.find(work => work.id === draftId)?.id ?? null,
  }));
}
