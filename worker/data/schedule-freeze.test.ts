import { afterEach, beforeEach, expect, it } from 'vitest';
import { SqliteD1Fixture } from '../test/sqlite-d1';
import { buildLocalSeedSql } from '../../scripts/lib/local-dev-bootstrap.mjs';
import { getScheduleFreeze, setScheduleFreeze } from './schedule-freeze';
import { updateActiveScheduleSegment, updateParticipant } from './admin';
import { withdrawApplication } from './collaboration';
import { reviewApplication } from './applications';

let f: SqliteD1Fixture;
beforeEach(() => { f = new SqliteD1Fixture(); f.sqlite.exec(buildLocalSeedSql()); });
afterEach(() => f.sqlite.close());

it('freezes assignment writes and withdrawal without stopping contact edits, and can be unfrozen', async () => {
  expect(await getScheduleFreeze(f.db)).toEqual({ isFrozen: false });
  await setScheduleFreeze(f.db, true);
  const owner = f.sqlite.prepare("SELECT user_id,application_id FROM participants WHERE id='part_seed_active'").get()!;
  await expect(updateActiveScheduleSegment(f.db,'seg_seed_102',{status:'released'},'host')).rejects.toMatchObject({status:409});
  await expect(withdrawApplication(f.db,owner.user_id as string)).rejects.toMatchObject({status:409});
  await expect(updateParticipant(f.db,'part_seed_active',{status:'withdrawn'},'host')).rejects.toMatchObject({status:409});
  await expect(reviewApplication(f.db,owner.application_id as string,{status:'rejected'},'host')).rejects.toMatchObject({status:409});
  expect(await updateParticipant(f.db,'part_seed_active',{status:'approved',contactHandle:'new contact'},'host')).toMatchObject({status:'approved'});
  expect(f.sqlite.prepare("SELECT current_participant_id FROM schedule_segments WHERE id='seg_seed_102'").get()).toEqual({current_participant_id:'part_seed_active'});
  await setScheduleFreeze(f.db,false);
  expect((await updateActiveScheduleSegment(f.db,'seg_seed_102',{status:'released'},'host')).ok).toBe(true);
});
