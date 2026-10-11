/** Run immediately after the guarded seat write in the same batch.
 * changes() keeps a rejected write from reordering; negative positions avoid unique collisions. */
export function reorderSchedule(db: D1Database, versionId: string) {
  return [
    db.prepare("UPDATE schedule_segments SET sort_order = -sort_order WHERE schedule_version_id = ? AND changes() > 0").bind(versionId),
    db.prepare(`WITH ranked AS MATERIALIZED (
      SELECT id, ROW_NUMBER() OVER (ORDER BY kind = 'extra', scheduled_at IS NULL,
        julianday(scheduled_at), -sort_order, id) AS position
      FROM schedule_segments WHERE schedule_version_id = ?
    ) UPDATE schedule_segments SET sort_order = (SELECT position FROM ranked WHERE ranked.id = schedule_segments.id)
      WHERE schedule_version_id = ? AND sort_order < 0`).bind(versionId, versionId),
  ];
}
