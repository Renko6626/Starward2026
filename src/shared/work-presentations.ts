import { z } from 'zod';
import { publicHttpsUrlSchema, workTypeSchema } from './works';

export const PRESENTATION_IMAGE_MAX_SIZE = 20 * 1024 * 1024;
export const imageIdSchema = z.string().uuid();
export const presentationContentSchema = z.discriminatedUnion('kind', [
  z.object({kind:z.literal('gallery'),images:z.array(z.object({id:imageIdSchema,alt:z.string().max(500)})).max(200)}),
  z.object({kind:z.literal('markdown'),markdown:z.string().max(400_000)}),
  z.object({kind:z.literal('bilibili'),bvid:z.string().regex(/^BV[0-9A-Za-z]{10}$/),page:z.number().int().min(1).max(1000).default(1)}),
]);
export type PresentationContent = z.infer<typeof presentationContentSchema>;
export const workPresentationInputSchema = z.object({
  title:z.string().trim().max(120),summary:z.string().trim().max(1600),workType:workTypeSchema.nullable(),
  thumbnailId:imageIdSchema.nullable(),thumbnailAlt:z.string().trim().max(500),
  sourceUrl:z.union([z.literal(''),publicHttpsUrlSchema]),content:presentationContentSchema.nullable(),
});
export type WorkPresentationInput = z.infer<typeof workPresentationInputSchema>;
export type AdminWorkPresentation = WorkPresentationInput & {
  segmentId:string;draftId:string;publishedAt:string|null;updatedAt:string;
  thumbnailUrl:string|null;legacyThumbnailUrl:string|null;
};
export type PublicPresentationContent = Exclude<PresentationContent,{kind:'gallery'}> |
  {kind:'gallery';images:{url:string;alt:string}[]};
export function parseBilibiliUrl(value: string): Extract<PresentationContent,{kind:'bilibili'}> | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['www.bilibili.com','bilibili.com','m.bilibili.com'].includes(url.hostname) || url.username || url.password) return null;
    const bvid = /^\/video\/(BV[0-9A-Za-z]{10})\/?$/.exec(url.pathname)?.[1];
    const page = Number(url.searchParams.get('p') ?? 1);
    return bvid && Number.isInteger(page) && page > 0 && page <= 1000 ? {kind:'bilibili',bvid,page} : null;
  } catch { return null; }
}
export function presentationIssues(input: WorkPresentationInput): string[] {
  const issues:string[] = [];
  if (!input.title.trim()) issues.push('请填写展示标题');
  if (!input.summary.trim()) issues.push('请填写展示简介');
  if (!input.workType) issues.push('请选择作品类型');
  if (!input.content) issues.push('请选择并填写展示正文');
  else if (input.content.kind === 'gallery' && !input.content.images.length) issues.push('请上传至少一张正文图片');
  else if (input.content.kind === 'markdown' && !input.content.markdown.trim()) issues.push('请填写 Markdown 正文');
  else if (input.content.kind === 'bilibili') {
    const parsed = parseBilibiliUrl(input.sourceUrl);
    if (!parsed || parsed.bvid !== input.content.bvid || parsed.page !== input.content.page) issues.push('请填写与播放器一致的 B 站视频链接');
  }
  return issues;
}
export function presentationImageUrl(segmentId:string,id:string,admin=false) {
  return `${admin ? '/api/admin' : '/api'}/presentations/${encodeURIComponent(segmentId)}/images/${encodeURIComponent(id)}`;
}
