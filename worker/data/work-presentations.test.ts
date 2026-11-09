import { afterEach, beforeEach, expect, it } from 'vitest';
import { SqliteD1Fixture } from '../test/sqlite-d1';
import { buildLocalSeedSql } from '../../scripts/lib/local-dev-bootstrap.mjs';
import { saveWorkPresentation, setPresentationPublication, getWorkPresentation } from './work-presentations';
import { getPublicWork, listPublicSchedule, listPublicWorks } from './works';
import { createWorkSubmissionReview } from './work-submissions';

let f: SqliteD1Fixture;
const article = { title:'正式作品',summary:'公开简介',workType:'text' as const,thumbnailId:null,thumbnailAlt:'',sourceUrl:'',content:{kind:'markdown' as const,markdown:'# 正文\n\n这是最终版本。'} };
beforeEach(() => {
  f = new SqliteD1Fixture(); f.sqlite.exec(buildLocalSeedSql());
  f.sqlite.exec("UPDATE event_windows SET is_enabled=1,opens_at=NULL,closes_at=NULL WHERE key='public_release_open'");
  f.sqlite.exec("INSERT INTO work_submissions (id,draft_id,version_number,title,work_type,summary,submitted_at) VALUES ('v1','draft_seed_active',1,'审核标题','text','审核简介','2026-11-10')");
});
afterEach(() => f.sqlite.close());
it('keeps a separate presentation and publishes only by an explicit admin action', async () => {
  await saveWorkPresentation(f.db,'seg_seed_102',article);
  expect(await getPublicWork(f.db,'draft_seed_active')).toBeNull();
  expect(await setPresentationPublication(f.db,'seg_seed_102',true,'host')).toMatchObject({ok:false});
  await createWorkSubmissionReview(f.db,'draft_seed_active','v1',{decision:'approved'},'host');
  expect((await getWorkPresentation(f.db,'seg_seed_102'))?.title).toBe('正式作品');
  expect(await listPublicWorks(f.db)).toEqual([]);
  expect(await setPresentationPublication(f.db,'seg_seed_102',true,'host')).toMatchObject({ok:true});
  expect(await getPublicWork(f.db,'draft_seed_active')).toMatchObject({work:{previewTitle:'正式作品',content:{kind:'markdown',markdown:article.content.markdown}}});
  await saveWorkPresentation(f.db,'seg_seed_102',{...article,title:'修正标题'});
  expect((await getPublicWork(f.db,'draft_seed_active'))?.work.previewTitle).toBe('修正标题');
  expect(await saveWorkPresentation(f.db,'seg_seed_102',{...article,content:null})).toMatchObject({ok:false});
  await setPresentationPublication(f.db,'seg_seed_102',false,'host');
  expect(await getPublicWork(f.db,'draft_seed_active')).toBeNull();
});
it('publishes preview fields without leaking article text, and stores just one row per slot', async () => {
  await saveWorkPresentation(f.db,'seg_seed_102',article);
  await saveWorkPresentation(f.db,'seg_seed_102',{...article,title:'最终标题'});
  const schedule = await listPublicSchedule(f.db,[]);
  expect(schedule.find(s=>s.id==='seg_seed_102')?.preview?.previewTitle).toBe('最终标题');
  expect(JSON.stringify(schedule)).not.toContain('这是最终版本');
  expect(f.sqlite.prepare('SELECT count(*) AS count FROM work_presentations').get()).toEqual({count:1});
});
it('publishes a Bilibili player only when its source video and page match',async()=>{
  await createWorkSubmissionReview(f.db,'draft_seed_active','v1',{decision:'approved'},'host');
  const video={...article,workType:'video' as const,sourceUrl:'https://www.bilibili.com/video/BV1B7411m7LV?p=2',content:{kind:'bilibili' as const,bvid:'BV1B7411m7LV',page:1}};
  await saveWorkPresentation(f.db,'seg_seed_102',video);
  expect(await setPresentationPublication(f.db,'seg_seed_102',true,'host')).toMatchObject({ok:false,code:'work_incomplete'});
  await saveWorkPresentation(f.db,'seg_seed_102',{...video,content:{...video.content,page:2}});
  expect(await setPresentationPublication(f.db,'seg_seed_102',true,'host')).toMatchObject({ok:true});
  expect((await getPublicWork(f.db,'draft_seed_active'))?.work.content).toEqual({kind:'bilibili',bvid:'BV1B7411m7LV',page:2});
});
