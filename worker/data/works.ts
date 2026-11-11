import type { PublicWork, PublicScheduleEntry, PublicWorkDetailResponse } from '../../src/shared/works';
import type { UpdateAdminProjectDraftResult } from './project-drafts';
import { getAdminProjectDraftDetail } from './project-drafts';
import { presentationFromRow, publicPresentationContent, setPresentationPublication, type PresentationRow } from './work-presentations';

// Public reads explicitly select display metadata and never submission archives.
export async function listPublicWorks(db: D1Database): Promise<PublicWork[]> {
  const { results } = await db.prepare(`SELECT w.*,s.code AS segmentCode,s.name AS segmentName,
    pp.credit_name AS publicAuthorName
    FROM work_presentations w JOIN project_drafts d ON d.id=w.draft_id
    JOIN participants p ON p.id=d.participant_id
    JOIN schedule_segments s ON s.id=w.segment_id AND s.current_participant_id=p.id
    LEFT JOIN portal_profiles pp ON pp.user_id=p.user_id
    WHERE w.published_at IS NOT NULL
    ORDER BY s.scheduled_at IS NULL,julianday(s.scheduled_at),s.sort_order,w.published_at,d.id`)
    .all<PresentationRow & {segmentCode:string;segmentName:string;publicAuthorName:string|null}>();
  return results.map((row,index) => {
    const p = presentationFromRow(row);
    return {id:p.draftId,previewTitle:p.title,previewSummary:p.summary,publicAuthorName:row.publicAuthorName,
      workType:p.workType,formatLabel:null,publicTags:[],coverUrl:p.thumbnailUrl,coverAlt:p.thumbnailAlt,
      workUrl:p.sourceUrl || null,publishedAt:p.publishedAt,segmentCode:row.segmentCode,segmentName:row.segmentName,
      observationNumber:index+1,content:publicPresentationContent(p)};
  });
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
  const existing = await getAdminProjectDraftDetail(db,id);
  if (!existing) return {ok:false,status:404,code:'not_found',message:'未找到对应作品。'};
  const row = await db.prepare('SELECT segment_id FROM project_drafts WHERE id=?').bind(id).first<{segment_id:string|null}>();
  if (!row?.segment_id) return {ok:false,status:409,code:'work_incomplete',message:'请先安排作品对应的坑位。'};
  const result = await setPresentationPublication(db,row.segment_id,publish,actorId);
  if (!result.ok) return result;
  return {ok:true,draft:(await getAdminProjectDraftDetail(db,id))!,message:result.message};
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
    p.credit_name AS publicAuthorName,
    CASE WHEN s.status IN ('held', 'locked', 'completed') THEN a.interest_format ELSE NULL END AS interestFormat,
    CASE WHEN s.status IN ('held', 'locked', 'completed') THEN a.intro_text ELSE NULL END AS introText,
    w.draft_id AS draftId, w.title AS previewTitle, w.summary AS previewSummary,
    w.work_type AS workType,
    CASE WHEN w.thumbnail_id IS NOT NULL THEN '/api/presentations/' || s.id || '/images/' || w.thumbnail_id ELSE w.legacy_thumbnail_url END AS coverUrl,
    w.thumbnail_alt AS coverAlt
    FROM schedule_segments s
    JOIN schedule_versions v ON v.id = s.schedule_version_id AND v.status = 'active'
    LEFT JOIN participants participant ON participant.id = s.current_participant_id AND participant.status IN ('approved', 'completed')
    LEFT JOIN portal_profiles p ON p.user_id = participant.user_id
    LEFT JOIN applications a ON a.user_id = participant.user_id AND a.status = 'approved'
    LEFT JOIN project_drafts d ON d.participant_id = participant.id AND d.segment_id = s.id
    LEFT JOIN work_presentations w ON w.draft_id=d.id AND w.segment_id=s.id
    WHERE s.is_visible = 1 AND s.kind <> 'special'
    ORDER BY s.kind = 'extra', s.scheduled_at IS NULL, julianday(s.scheduled_at), s.sort_order, s.id`).all<Row>();
  return results.map(({ draftId, previewTitle, previewSummary, workType, coverUrl, coverAlt, ...entry }) => ({
    ...entry,
    preview: draftId ? { previewTitle, previewSummary, workType, coverUrl, coverAlt } : null,
    workId: works.find(work => work.id === draftId)?.id ?? null,
  }));
}
