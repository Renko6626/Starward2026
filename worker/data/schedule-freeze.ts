import { HTTPException } from 'hono/http-exception';

export async function getScheduleFreeze(db: D1Database): Promise<{ isFrozen: boolean }> {
  const row = await db.prepare("SELECT is_frozen FROM schedule_versions WHERE status='active' LIMIT 1").first<{is_frozen:number}>();
  return { isFrozen: Boolean(row?.is_frozen) };
}

export async function setScheduleFreeze(db: D1Database, isFrozen: boolean) {
  await db.prepare("UPDATE schedule_versions SET is_frozen=? WHERE status='active'").bind(isFrozen ? 1 : 0).run();
  return getScheduleFreeze(db);
}

export async function requireMutableSchedule(db: D1Database) {
  if ((await getScheduleFreeze(db)).isFrozen) throw new HTTPException(409, {message:'排期已冻结，不能调整坑位或作者。请联系主催；管理员需先解除冻结。'});
}

export async function requireMutableAssignedParticipant(db: D1Database, participantId: string) {
  const assigned = await db.prepare(`SELECT s.id FROM schedule_segments s JOIN schedule_versions v ON v.id=s.schedule_version_id
    WHERE v.status='active' AND s.current_participant_id=? LIMIT 1`).bind(participantId).first();
  if (assigned) await requireMutableSchedule(db);
}
