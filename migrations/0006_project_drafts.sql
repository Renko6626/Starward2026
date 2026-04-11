CREATE TABLE IF NOT EXISTS project_drafts (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL UNIQUE,
  segment_id TEXT,
  preview_title TEXT,
  preview_summary TEXT,
  public_author_name TEXT,
  format_label TEXT,
  public_tags_json TEXT,
  content_note TEXT,
  content_warnings TEXT,
  review_note TEXT,
  preview_status TEXT NOT NULL CHECK (
    preview_status IN ('not_started', 'draft', 'submitted', 'changes_requested', 'approved')
  ),
  review_status TEXT NOT NULL CHECK (
    review_status IN ('not_started', 'draft', 'submitted', 'changes_requested', 'approved')
  ),
  preview_submitted_at TEXT,
  review_submitted_at TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT,
  admin_feedback TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
  FOREIGN KEY (segment_id) REFERENCES schedule_segments(id) ON DELETE SET NULL
);
