-- Expand public and application types; merge mixed intentions into other.
-- Preserve participant application links across ON DELETE SET NULL during the rebuild.
CREATE TABLE type_migration_participant_links AS SELECT id, application_id FROM participants;
UPDATE applications SET interest_format = 'other' WHERE interest_format = 'mixed';

CREATE TABLE type_migration_applications (
  id TEXT PRIMARY KEY,
  contact_email TEXT,
  contact_handle TEXT,
  interest_format TEXT NOT NULL CHECK (
    interest_format IN ('novel', 'illustration', 'comic', 'music', 'video', 'cosplay', 'other')
  ),
  intro_text TEXT,
  portfolio_url TEXT,
  message_to_hosts TEXT,
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'approved', 'rejected', 'withdrawn')
  ),
  reviewed_by TEXT,
  reviewed_at TEXT,
  admin_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  user_id TEXT
);

INSERT INTO type_migration_applications SELECT * FROM applications;
DROP TABLE applications;
ALTER TABLE type_migration_applications RENAME TO applications;
UPDATE participants SET application_id = (
  SELECT saved.application_id FROM type_migration_participant_links saved WHERE saved.id = participants.id
);
DROP TABLE type_migration_participant_links;

CREATE INDEX idx_applications_status_created_at ON applications(status, created_at DESC);
CREATE INDEX idx_applications_contact_email ON applications(contact_email);
CREATE UNIQUE INDEX uq_applications_user_id ON applications(user_id) WHERE user_id IS NOT NULL;

CREATE TABLE type_migration_project_drafts (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL UNIQUE,
  segment_id TEXT,
  preview_title TEXT,
  preview_summary TEXT,
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
  work_type TEXT CHECK (work_type IS NULL OR work_type IN ('text', 'illustration', 'comic', 'music', 'video', 'cosplay', 'other')),
  cover_url TEXT,
  cover_alt TEXT,
  work_url TEXT,
  published_at TEXT CHECK (published_at IS NULL OR (preview_status = 'approved' AND review_status = 'approved')),
  release_confirmed_at TEXT,
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
  FOREIGN KEY (segment_id) REFERENCES schedule_segments(id) ON DELETE SET NULL
);

INSERT INTO type_migration_project_drafts SELECT * FROM project_drafts;
DROP TABLE project_drafts;
ALTER TABLE type_migration_project_drafts RENAME TO project_drafts;
