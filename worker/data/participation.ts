import type { ParticipationStatistics } from "../../src/shared/applications";

export async function getParticipationStatistics(db: D1Database): Promise<ParticipationStatistics> {
  // One statement keeps all counts on the same database snapshot.
  const row = await db.prepare(`
    WITH usable_segments AS (
      SELECT s.status, s.current_participant_id
      FROM schedule_segments s
      JOIN schedule_versions v ON v.id = s.schedule_version_id AND v.status = 'active'
      WHERE s.status IN ('open', 'released', 'held', 'completed')
    )
    SELECT
      (SELECT COUNT(*) FROM participants p JOIN "user" u ON u.id = p.user_id) AS registeredCreators,
      EXISTS(SELECT 1 FROM schedule_versions WHERE status = 'active') AS schedulePublished,
      (SELECT COUNT(*) FROM usable_segments) AS total,
      (SELECT COUNT(*) FROM usable_segments
       WHERE status = 'completed' OR (status = 'held' AND current_participant_id IS NOT NULL)) AS occupied
  `).first<{ registeredCreators: number; schedulePublished: number; total: number; occupied: number }>();
  if (!row) throw new Error("Participation statistics unavailable");
  return {
    registeredCreators: row.registeredCreators,
    schedule: row.schedulePublished ? { occupied: row.occupied, total: row.total } : null,
  };
}
