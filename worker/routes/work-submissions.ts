import { Hono } from 'hono';
import { requireParticipantSession } from '../lib/auth';
import { getRequiredDb, jsonError } from '../lib/http';
import { resolveProjectWorkspaceEligibility } from '../lib/portal-access';
import { getPortalProjectDraftDetail } from '../data/project-drafts';
import { createWorkSubmission, getWorkSubmissionDetail, getWorkSubmissionWorkspace } from '../data/work-submissions';
import { createWorkSubmissionSchema } from '../../src/shared/work-submissions';
import type { AppRouteConfig } from '../lib/types';

export const workSubmissionsApi = new Hono<AppRouteConfig>();
workSubmissionsApi.use('*', async (c,next) => {
  c.header('Cache-Control','private, no-store');
  if (c.req.method !== 'GET' && c.req.header('Origin') && c.req.header('Origin') !== new URL(c.req.url).origin)
    return jsonError(c,403,'invalid_origin','请求来源不正确。');
  await next();
});
workSubmissionsApi.all('/*', async c => {
  const session = await requireParticipantSession(c);
  if (!session?.session) return jsonError(c,401,'unauthorized','请先登录。');
  const eligibility = resolveProjectWorkspaceEligibility(session.participant);
  if (!eligibility.ok || !session.participant) return jsonError(c,403,'submission_ineligible',eligibility.ok ? '未找到参与记录。' : eligibility.message);
  const db = getRequiredDb(c), draft = await getPortalProjectDraftDetail(db,session.participant.id);
  if (!draft) return jsonError(c,404,'project_draft_missing','未找到作品记录。');
  const suffix = c.req.path.split('/submissions')[1]?.replace(/^\//,'') ?? '';
  if (c.req.method === 'GET' && !suffix) return c.json(await getWorkSubmissionWorkspace(db,draft.id));
  if (c.req.method === 'GET') {
    const detail = await getWorkSubmissionDetail(db,draft.id,suffix);
    return detail ? c.json(detail) : jsonError(c,404,'submission_missing','未找到对应作品版本。');
  }
  if (c.req.method === 'POST' && !suffix) {
    const parsed = createWorkSubmissionSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return jsonError(c,422,'invalid_submission',parsed.error.issues[0].message);
    const result = await createWorkSubmission(db,session.participant.id,parsed.data);
    return result.ok ? c.json(result,201) : jsonError(c,result.status,result.code,result.message);
  }
  return jsonError(c,404,'not_found','未找到接口。');
});
