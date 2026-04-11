CREATE TABLE IF NOT EXISTS event_windows (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 0 CHECK (is_enabled IN (0, 1)),
  opens_at TEXT,
  closes_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO event_windows (key, label, is_enabled, opens_at, closes_at, created_at, updated_at)
VALUES
  ('application_open', '报名开放', 0, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('segment_claim_open', '时间段认领开放', 0, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('segment_change_open', '时间段变更 / 释放开放', 0, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('preview_submit_open', '预告资料提交开放', 0, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('review_submit_open', '审查说明提交开放', 0, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('public_release_open', '公开发布开放', 0, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO NOTHING;
