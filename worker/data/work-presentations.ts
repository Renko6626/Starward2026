import { workPresentationInputSchema, presentationIssues, presentationImageUrl, type AdminWorkPresentation, type WorkPresentationInput, type PublicPresentationContent } from '../../src/shared/work-presentations';
import { getWorkReviewSummary } from './work-submissions';
import { getWindowOrFallback } from '../lib/windows';
import { listEventWindows } from './event-windows';
import { createPrefixedId } from '../lib/ids';

export type PresentationRow = {
  segment_id:string;draft_id:string;title:string;summary:string;work_type:WorkPresentationInput['workType'];
  thumbnail_id:string|null;thumbnail_alt:string;legacy_thumbnail_url:string|null;
  content_json:string|null;source_url:string;published_at:string|null;updated_at:string;
};
const failure = (status:number,code:string,message:string) => ({ok:false as const,status,code,message});

export function presentationFromRow(row:PresentationRow):AdminWorkPresentation {
  return {segmentId:row.segment_id,draftId:row.draft_id,title:row.title,summary:row.summary,workType:row.work_type,
    thumbnailId:row.thumbnail_id,thumbnailAlt:row.thumbnail_alt,legacyThumbnailUrl:row.legacy_thumbnail_url,
    thumbnailUrl:row.thumbnail_id ? presentationImageUrl(row.segment_id,row.thumbnail_id) : row.legacy_thumbnail_url,
    sourceUrl:row.source_url,content:row.content_json ? JSON.parse(row.content_json) : null,
    publishedAt:row.published_at,updatedAt:row.updated_at};
}
export async function getWorkPresentation(db:D1Database,segmentId:string) {
  const row = await db.prepare('SELECT * FROM work_presentations WHERE segment_id=?').bind(segmentId).first<PresentationRow>();
  return row ? presentationFromRow(row) : null;
}
export async function getPresentationSlot(db:D1Database,segmentId:string) {
  return db.prepare(`SELECT d.id AS draftId,p.id AS participantId,p.status,pp.credit_name AS authorName
    FROM schedule_segments s JOIN participants p ON p.id=s.current_participant_id
    JOIN project_drafts d ON d.participant_id=p.id AND d.segment_id=s.id
    LEFT JOIN portal_profiles pp ON pp.user_id=p.user_id
    WHERE s.id=? AND s.status IN ('held','locked','completed')`).bind(segmentId)
    .first<{draftId:string;participantId:string;status:string;authorName:string|null}>();
}
export async function saveWorkPresentation(db:D1Database,segmentId:string,input:WorkPresentationInput) {
  const parsed = workPresentationInputSchema.safeParse(input);
  if (!parsed.success) return failure(422,'invalid_presentation',parsed.error.issues[0]?.message ?? '展示资料不正确。');
  const slot = await getPresentationSlot(db,segmentId);
  if (!slot) return failure(409,'presentation_slot_missing','请先为这个坑位安排作者及作品。');
  const existing = await getWorkPresentation(db,segmentId);
  if (existing && existing.draftId !== slot.draftId) return failure(409,'presentation_author_changed','坑位作者已变化，请先联系主催核对原展示资料。');
  const data = parsed.data;
  if (existing?.publishedAt) {
    const issues = presentationIssues(data);
    if (issues.length) return failure(422,'presentation_incomplete',issues.join('；')+'。');
  }
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO work_presentations
    (segment_id,draft_id,title,summary,work_type,thumbnail_id,thumbnail_alt,display_kind,content_json,source_url,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(segment_id) DO UPDATE SET
    title=excluded.title,summary=excluded.summary,work_type=excluded.work_type,thumbnail_id=excluded.thumbnail_id,
    thumbnail_alt=excluded.thumbnail_alt,legacy_thumbnail_url=CASE WHEN excluded.thumbnail_id IS NOT NULL THEN NULL ELSE legacy_thumbnail_url END,
    display_kind=excluded.display_kind,content_json=excluded.content_json,source_url=excluded.source_url,updated_at=excluded.updated_at`)
    .bind(segmentId,slot.draftId,data.title,data.summary,data.workType,data.thumbnailId,data.thumbnailAlt,
      data.content?.kind ?? null,data.content ? JSON.stringify(data.content) : null,data.sourceUrl,now,now).run();
  return {ok:true as const,presentation:(await getWorkPresentation(db,segmentId))!,message:'展示资料已保存。'};
}
export async function setPresentationPublication(db:D1Database,segmentId:string,publish:boolean,actor:string) {
  if (publish && !getWindowOrFallback(await listEventWindows(db),'public_release_open').isOpen) return failure(409,'release_closed','公开发布窗口尚未开放或已结束。');
  const existing = await getWorkPresentation(db,segmentId);
  if (!existing) return failure(409,'work_incomplete','请先保存展示资料。');
  if (Boolean(existing.publishedAt) === publish) return {ok:true as const,presentation:existing,message:publish ? '作品已公开。' : '作品已撤下。'};
  const slot = await getPresentationSlot(db,segmentId);
  if (publish) {
    if (!slot || slot.draftId !== existing.draftId || !['approved','completed'].includes(slot.status) || !slot.authorName?.trim())
      return failure(409,'presentation_ineligible','请核对坑位作者、参与资格及署名。');
    if ((await getWorkReviewSummary(db,existing.draftId)).status !== 'approved') return failure(409,'work_incomplete','完整作品内容需通过审核。');
    const issues = presentationIssues(existing);
    if (issues.length) return failure(409,'work_incomplete',issues.join('；')+'。');
  }
  const now = new Date().toISOString();
  await db.batch([
    db.prepare('UPDATE work_presentations SET published_at=?,updated_at=? WHERE segment_id=?').bind(publish?now:null,now,segmentId),
    db.prepare(`INSERT INTO participant_events (id,participant_id,actor_type,actor_id,event_type,target_type,target_id,payload_json,created_at)
      SELECT ?,d.participant_id,'admin',?,?,'project_draft',d.id,'{}',? FROM project_drafts d WHERE d.id=? AND changes()=1`)
      .bind(createPrefixedId('pevt'),actor,publish?'work_published':'work_unpublished',now,existing.draftId),
  ]);
  return {ok:true as const,presentation:(await getWorkPresentation(db,segmentId))!,message:publish?'作品已公开。':'作品已撤下。'};
}
export function publicPresentationContent(p:AdminWorkPresentation):PublicPresentationContent|null {
  return p.content?.kind === 'gallery' ? {kind:'gallery',images:p.content.images.map(i=>({url:presentationImageUrl(p.segmentId,i.id),alt:i.alt}))} : p.content;
}
export function presentationImageKey(segmentId:string,imageId:string) {
  return `presentations/${segmentId}/${imageId}`;
}
