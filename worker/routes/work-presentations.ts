import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { imageIdSchema, PRESENTATION_IMAGE_MAX_SIZE, workPresentationInputSchema } from '../../src/shared/work-presentations';
import { getWorkPresentation, getPresentationSlot, saveWorkPresentation, setPresentationPublication, presentationImageKey } from '../data/work-presentations';
import { getRequiredDb, jsonError } from '../lib/http';
import { getAdminIdentity } from '../lib/admin';
import type { AppContext, AppRouteConfig } from '../lib/types';

// Mounted below the existing administrator authentication middleware.
export const adminPresentationsApi = new Hono<AppRouteConfig>();
export const presentationImagesApi = new Hono<AppRouteConfig>();
const imagePath='/presentations/:segmentId/images/:imageId';
const editorPath='/segments/:segmentId/presentation';

function validImagePath(c:AppContext) {
  return /^[\w-]{1,64}$/.test(c.req.param('segmentId')! ?? '') && imageIdSchema.safeParse(c.req.param('imageId')!).success;
}
async function readImage(c:AppContext) {
  const object = await c.env.WORK_FILES?.get(presentationImageKey(c.req.param('segmentId')!,c.req.param('imageId')!));
  if (!object) return jsonError(c,404,'image_missing','未找到展示图片。');
  return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType ?? 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
function imageType(bytes:Uint8Array) {
  if (bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return 'image/jpeg';
  if ([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)) return 'image/png';
  const tag=new TextDecoder().decode(bytes.slice(0,12));
  if (tag.startsWith('GIF87a') || tag.startsWith('GIF89a')) return 'image/gif';
  if (tag.startsWith('RIFF') && tag.slice(8,12)==='WEBP') return 'image/webp';
  return null;
}
adminPresentationsApi.get(editorPath,async c=>{
  const db=getRequiredDb(c),id=c.req.param('segmentId')!;
  if (!await getPresentationSlot(db,id)) return jsonError(c,409,'presentation_slot_missing','请先安排坑位作者及作品。');
  return c.json({presentation:await getWorkPresentation(db,id)});
});
adminPresentationsApi.put(editorPath,async c=>{
  const parsed=workPresentationInputSchema.safeParse(await c.req.json().catch(()=>null));
  if (!parsed.success) return jsonError(c,422,'invalid_presentation',parsed.error.issues[0]?.message ?? '展示资料不正确。');
  const data=parsed.data,id=c.req.param('segmentId')!;
  const ids=[data.thumbnailId,...(data.content?.kind==='gallery'?data.content.images.map(i=>i.id):[])].filter((v):v is string=>Boolean(v));
  for (const imageId of new Set(ids)) {
    if (!c.env.WORK_FILES) return jsonError(c,503,'storage_unavailable','展示图片存储暂时不可用。');
    if (!await c.env.WORK_FILES.head(presentationImageKey(id,imageId))) return jsonError(c,422,'image_missing','所选图片尚未上传或不属于此坑位。');
  }
  const result=await saveWorkPresentation(getRequiredDb(c),id,data);
  return result.ok?c.json(result):jsonError(c,result.status,result.code,result.message);
});
adminPresentationsApi.post(editorPath+'/images',bodyLimit({maxSize:PRESENTATION_IMAGE_MAX_SIZE,onError:c=>jsonError(c,413,'image_too_large','单张展示图片不能超过 20 MiB。')}),async c=>{
  const id=c.req.param('segmentId')!;
  if (!/^[\w-]{1,64}$/.test(id) || !await getPresentationSlot(getRequiredDb(c),id)) return jsonError(c,409,'presentation_slot_missing','请先安排坑位作者及作品。');
  if (!c.env.WORK_FILES) return jsonError(c,503,'storage_unavailable','展示图片存储暂时不可用。');
  const body=await c.req.arrayBuffer(),contentType=imageType(new Uint8Array(body));
  if (!contentType) return jsonError(c,422,'invalid_image','请上传 JPEG、PNG、WebP 或 GIF 图片。');
  const imageId=crypto.randomUUID();
  await c.env.WORK_FILES.put(presentationImageKey(id,imageId),body,{httpMetadata:{contentType}});
  return c.json({id:imageId},201);
});
adminPresentationsApi.get(imagePath,async c=>{
  if (!validImagePath(c)) return jsonError(c,404,'image_missing','未找到展示图片。');
  return readImage(c);
});
for (const action of ['publish','unpublish'] as const) adminPresentationsApi.post(editorPath+'/'+action,async c=>{
  const result=await setPresentationPublication(getRequiredDb(c),c.req.param('segmentId')!,action==='publish',getAdminIdentity(c));
  return result.ok?c.json(result):jsonError(c,result.status,result.code,result.message);
});

presentationImagesApi.get(imagePath,async c=>{
  c.header('Cache-Control','no-store');
  if (!validImagePath(c)) return jsonError(c,404,'image_missing','未找到展示图片。');
  const db=getRequiredDb(c),id=c.req.param('segmentId')!,imageId=c.req.param('imageId')!;
  const p=await getWorkPresentation(db,id),slot=await getPresentationSlot(db,id);
  if (!p || !slot || slot.draftId!==p.draftId) return jsonError(c,404,'image_missing','未找到展示图片。');
  const visibleSlot=await db.prepare(`SELECT s.id FROM schedule_segments s JOIN schedule_versions v ON v.id=s.schedule_version_id
    JOIN participants p ON p.id=s.current_participant_id WHERE s.id=? AND s.is_visible=1 AND s.kind<>'special'
    AND v.status='active' AND p.status IN ('approved','completed')`).bind(id).first();
  const thumbnail=p.thumbnailId===imageId && (visibleSlot || p.publishedAt);
  const gallery=p.publishedAt && p.content?.kind==='gallery' && p.content.images.some(i=>i.id===imageId);
  if (!thumbnail && !gallery) return jsonError(c,404,'image_missing','未找到展示图片。');
  return readImage(c);
});
