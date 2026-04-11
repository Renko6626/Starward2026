CREATE TABLE IF NOT EXISTS schedule_versions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('draft', 'active', 'archived')
  ),
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO schedule_versions (id, title, status, published_at, created_at, updated_at)
VALUES
  ('schedule_default', '默认排期', 'active', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS schedule_segments (
  id TEXT PRIMARY KEY,
  schedule_version_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (
    status IN ('open', 'held', 'locked', 'released', 'completed')
  ),
  current_participant_id TEXT,
  claimed_at TEXT,
  released_at TEXT,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (schedule_version_id) REFERENCES schedule_versions(id) ON DELETE CASCADE,
  FOREIGN KEY (current_participant_id) REFERENCES participants(id) ON DELETE SET NULL
);
