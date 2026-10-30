import { afterEach, beforeEach, expect, it } from 'vitest';
import { Hono } from 'hono';
import { SqliteD1Fixture } from '../test/sqlite-d1';
import { buildLocalSeedSql, createSignedSessionCookieValue } from '../../scripts/lib/local-dev-bootstrap.mjs';
import { portalApi } from './portal';
import { adminApi } from './admin';
import { adminTestSession } from '../test/admin-session';
import type { AppBindings, AppRouteConfig } from '../lib/types';

const app = new Hono<AppRouteConfig>().route('/api/portal',portalApi).route('/api/admin',adminApi);
let f: SqliteD1Fixture; let env: AppBindings; let headers: Record<string,string>;
beforeEach(async () => {
  f = new SqliteD1Fixture(); f.sqlite.exec(buildLocalSeedSql());
  f.sqlite.exec("UPDATE event_windows SET is_enabled=1,opens_at=NULL WHERE key='work_upload_open'");
  env = { DB:f.db, BETTER_AUTH_SECRET:'test-submission-secret-at-least-32-characters', BETTER_AUTH_URL:'http://localhost', ALLOW_LOCAL_DEV_ORIGINS:'true' };
  headers = { origin:'http://localhost', 'content-type':'application/json',cookie:`better-auth.session_token=${await createSignedSessionCookieValue({sessionToken:'starward-local-approved-session',secret:env.BETTER_AUTH_SECRET!})}` };
});
afterEach(() => f.sqlite.close());
const base = 'http://localhost/api/portal/project/submissions';
it('authenticates submission reads and lets the author see the saved review without exposing the reviewer identity', async () => {
  expect((await app.request(base,{},env)).status).toBe(401);
  f.sqlite.exec("INSERT INTO work_files (id,draft_id,object_key,upload_id,filename,size,content_type,created_at,completed_at) VALUES ('f','draft_seed_active','k','u','story.txt',3,'text/plain','2026-10-31','2026-10-31')");
  const response = await app.request(base,{method:'POST',headers,body:JSON.stringify({title:'作品',workType:'text',summary:'简介',fileIds:['f']})},env);
  expect(response.status).toBe(201);
  const id = (await response.json() as {workspace:{latest:{id:string}}}).workspace.latest.id;
  expect((await app.request('http://localhost/api/portal/project/files/f',{method:'DELETE',headers},env)).status).toBe(409);
  const admin = await adminTestSession(f.db);
  const saved = await app.request(`http://localhost/api/admin/project-drafts/draft_seed_active/submissions/${id}/reviews`,{
    method:'POST',headers:{...admin.headers,'content-type':'application/json'},body:JSON.stringify({decision:'changes_requested',feedback:'请调整结尾'})
  },{...env,...admin.env});
  expect(saved.status).toBe(200);
  const workspace = await (await app.request(base,{headers},env)).json();
  expect(workspace).toMatchObject({review:{status:'changes_requested'},latestFeedback:{feedback:'请调整结尾',versionNumber:1}});
  expect(JSON.stringify(workspace)).not.toContain('admin@example.com');
  const other = { ...headers,cookie:`better-auth.session_token=${await createSignedSessionCookieValue({sessionToken:'starward-local-pending-session',secret:env.BETTER_AUTH_SECRET!})}` };
  expect((await app.request(`${base}/${id}`,{headers:other},env)).status).toBe(403);
  f.sqlite.exec("UPDATE participants SET status='approved' WHERE id='part_seed_pending'");
  expect((await app.request(`${base}/${id}`,{headers:other},env)).status).toBe(404);
  expect((await app.request(base,{method:'POST',headers:{...headers,origin:'https://other.example'},body:'{}'},env)).status).toBe(403);
});
it('rejects timed closing for submissions and retires the old author and admin review writes', async () => {
  const admin = await adminTestSession(f.db);
  expect((await app.request('http://localhost/api/admin/event-windows/work_upload_open',{
    method:'PATCH',headers:{...admin.headers,'content-type':'application/json'},body:JSON.stringify({isEnabled:true,closesAt:'2026-11-11T15:00:00Z'})
  },{...env,...admin.env})).status).toBe(422);
  for (const [path,method] of [['preview','PATCH'],['review','PATCH'],['preview/submit','POST'],['review/submit','POST']]) {
    expect((await app.request(`http://localhost/api/portal/project/${path}`,{method,headers,body:'{}'},env)).status).toBe(410);
  }
  expect((await app.request('http://localhost/api/admin/project-drafts/draft_seed_active',{
    method:'PATCH',headers:{...admin.headers,'content-type':'application/json'},body:'{}'
  },{...env,...admin.env})).status).toBe(410);
});
