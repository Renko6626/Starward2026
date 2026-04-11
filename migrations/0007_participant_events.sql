CREATE TABLE IF NOT EXISTS participant_events (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (
    actor_type IN ('participant', 'admin', 'system')
  ),
  actor_id TEXT,
  event_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
);
