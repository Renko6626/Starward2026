import { afterEach, beforeEach, expect, it } from 'vitest';
import { Hono } from 'hono';
import { SqliteD1Fixture } from '../test/sqlite-d1';
import { buildLocalSeedSql } from '../../scripts/lib/local-dev-bootstrap.mjs';
import { adminTestSession } from '../test/admin-session';
import { adminApi } from './admin';
import { presentationImagesApi } from './work-presentations';
import type { AppRouteConfig } from '../lib/types';

let f:SqliteD1Fixture;
beforeEach(()=>{f=new SqliteD1Fixture();f.sqlite.exec(buildLocalSeedSql());});
afterEach(()=>f.sqlite.close());
it('limits uploads to admins and separates public thumbnail access from unpublished gallery files',async()=>{
  const objects=new Map<string,{body:Uint8Array;type:string}>();
  const bucket={
    async put(key:string,body:ArrayBuffer,options:{httpMetadata:{contentType:string}}){objects.set(key,{body:new Uint8Array(body),type:options.httpMetadata.contentType});},
    async head(key:string){return objects.has(key)?{}:null;},
    async get(key:string){const o=objects.get(key);return o?{body:o.body,httpMetadata:{contentType:o.type}}:null;},
  } as unknown as R2Bucket;
  const app=new Hono<AppRouteConfig>().route('/api/admin',adminApi).route('/api',presentationImagesApi);
  const admin=await adminTestSession(f.db),env={...admin.env,DB:f.db,WORK_FILES:bucket};
  const path='http://localhost/api/admin/segments/seg_seed_102/presentation';
  expect((await app.request(path,{method:'POST'},env)).status).toBe(401);
  async function upload(){
    const r=await app.request(path+'/images',{method:'POST',headers:admin.headers,body:new Uint8Array([137,80,78,71,13,10,26,10,0])},env);
    expect(r.status).toBe(201);return (await r.json() as {id:string}).id;
  }
  const thumbnailId=await upload(),bodyId=await upload();
  const body={title:'画集',summary:'简介',workType:'illustration',thumbnailId,thumbnailAlt:'预览',sourceUrl:'',content:{kind:'gallery',images:[{id:bodyId,alt:'正文'}]}};
  const save=await app.request(path,{method:'PUT',headers:{...admin.headers,'Content-Type':'application/json'},body:JSON.stringify(body)},env);
  expect(save.status).toBe(200);
  const publicPath='http://localhost/api/presentations/seg_seed_102/images/';
  expect((await app.request(publicPath+thumbnailId,{},env)).status).toBe(200);
  expect((await app.request(publicPath+bodyId,{},env)).status).toBe(404);
  f.sqlite.exec("UPDATE work_presentations SET published_at='2026-11-10'");
  const visible=await app.request(publicPath+bodyId,{},env);
  expect(visible.status).toBe(200);expect(visible.headers.get('Cache-Control')).toBe('no-store');
  f.sqlite.exec('UPDATE work_presentations SET published_at=NULL');
  expect((await app.request(publicPath+bodyId,{},env)).status).toBe(404);
  expect((await app.request(path+'/publish',{method:'POST',headers:{...admin.headers,origin:'https://other.example'}},env)).status).toBe(403);
});
