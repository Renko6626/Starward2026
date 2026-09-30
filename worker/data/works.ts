import { getWorkPublicationIssues, type PublicWork, type PublicWorkDetailResponse } from "../../src/shared/works";
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
    ORDER BY s.sort_order IS NULL, s.sort_order, d.published_at, d.id`).all<PublicWorkRow>();
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
