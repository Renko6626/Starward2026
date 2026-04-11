import {
  eventWindowLabels,
  type EventWindowKey,
  type EventWindowSummary,
  type UpdateEventWindowInput,
} from "../../src/shared/windows";
import { mapEventWindowRow, type EventWindowRow } from "../lib/windows";
import { nowIso } from "../lib/time";

export async function listEventWindows(db: D1Database): Promise<EventWindowSummary[]> {
  const result = await db
    .prepare(
      `SELECT key, label, is_enabled, opens_at, closes_at, updated_at
       FROM event_windows
       ORDER BY key ASC`,
    )
    .all<EventWindowRow>();

  return (result.results ?? []).map(mapEventWindowRow);
}

export async function updateEventWindow(
  db: D1Database,
  key: EventWindowKey,
  input: UpdateEventWindowInput,
): Promise<EventWindowSummary | null> {
  const now = nowIso();

  const result = await db
    .prepare(
      `UPDATE event_windows
       SET label = ?,
           is_enabled = ?,
           opens_at = ?,
           closes_at = ?,
           updated_at = ?
       WHERE key = ?`,
    )
    .bind(
      eventWindowLabels[key],
      input.isEnabled ? 1 : 0,
      input.opensAt,
      input.closesAt,
      now,
      key,
    )
    .run();

  if ((result.meta?.changes ?? 0) < 1) {
    return null;
  }

  return getEventWindow(db, key);
}

async function getEventWindow(db: D1Database, key: EventWindowKey): Promise<EventWindowSummary | null> {
  const row = await db
    .prepare(
      `SELECT key, label, is_enabled, opens_at, closes_at, updated_at
       FROM event_windows
       WHERE key = ?
       LIMIT 1`,
    )
    .bind(key)
    .first<EventWindowRow>();

  return row ? mapEventWindowRow(row) : null;
}
