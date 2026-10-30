CREATE TABLE work_submissions (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES project_drafts(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  title TEXT NOT NULL,
  work_type TEXT NOT NULL CHECK (work_type IN ('text', 'illustration', 'comic', 'music', 'video', 'cosplay', 'other')),
  summary TEXT NOT NULL,
  version_note TEXT,
  submitted_at TEXT NOT NULL,
  UNIQUE (draft_id, version_number)
);
ALTER TABLE work_files ADD COLUMN submission_id TEXT REFERENCES work_submissions(id);
CREATE INDEX idx_work_files_submission ON work_files(submission_id);
CREATE TABLE work_submission_reviews (
  id INTEGER PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES work_submissions(id) ON DELETE CASCADE,
  feedback TEXT,
  decision TEXT CHECK (decision IN ('approved', 'changes_requested', 'rejected')),
  reviewed_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (decision = 'approved' OR length(trim(COALESCE(feedback, ''))) > 0)
);
CREATE INDEX idx_work_submission_reviews_submission ON work_submission_reviews(submission_id, id);
UPDATE event_windows SET closes_at = NULL WHERE key = 'work_upload_open';
