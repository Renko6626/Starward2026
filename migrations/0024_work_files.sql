-- File bytes live in private R2; D1 holds ownership and completed part receipts.
CREATE TABLE work_files (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES project_drafts(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  upload_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  size INTEGER NOT NULL CHECK (size > 0),
  content_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX idx_work_files_draft ON work_files(draft_id, created_at);

CREATE TABLE work_file_parts (
  file_id TEXT NOT NULL REFERENCES work_files(id) ON DELETE CASCADE,
  part_number INTEGER NOT NULL CHECK (part_number > 0),
  etag TEXT NOT NULL,
  PRIMARY KEY (file_id, part_number)
);

INSERT INTO event_windows (key, label, is_enabled, opens_at, closes_at, created_at, updated_at)
VALUES ('work_upload_open', '作品文件上传开放', 0, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
