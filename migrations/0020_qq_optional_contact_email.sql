-- QQ accounts have no required real email. Preserve dependent records during D1 table rebuilds.

PRAGMA defer_foreign_keys = ON;

CREATE TABLE qq_migration_applications AS SELECT * FROM applications;

CREATE TABLE qq_migration_participants AS SELECT * FROM participants;

CREATE TABLE qq_migration_portal_profiles AS SELECT * FROM portal_profiles;

CREATE TABLE qq_migration_participant_events AS SELECT * FROM participant_events;

CREATE TABLE qq_migration_project_drafts AS SELECT * FROM project_drafts;

CREATE TABLE qq_migration_segment_swap_requests AS SELECT * FROM segment_swap_requests;

CREATE TABLE qq_migration_schedule_segments AS SELECT * FROM schedule_segments;

DROP TRIGGER expire_swaps_on_segment_change;

DROP TRIGGER expire_swaps_on_participant_change;

DROP TRIGGER expire_swaps_on_schedule_change;

DROP TRIGGER expire_swaps_on_window_change;

DROP TABLE participant_events;

DROP TABLE project_drafts;

DROP TABLE segment_swap_requests;

DROP TABLE portal_profiles;

DROP TABLE participants;

DROP TABLE applications;

CREATE TABLE applications (
  id TEXT PRIMARY KEY,
  contact_email TEXT,
  contact_handle TEXT,
  interest_format TEXT NOT NULL CHECK (
    interest_format IN ('novel', 'illustration', 'comic', 'music', 'video', 'mixed', 'other')
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
  updated_at TEXT NOT NULL
, user_id TEXT);

INSERT INTO applications SELECT * FROM qq_migration_applications;

CREATE TABLE "participants" (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE,
  application_id TEXT,
  invite_email TEXT UNIQUE,
  contact_handle TEXT,
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'approved', 'withdrawn', 'completed')
  ),
  invited_at TEXT,
  activated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE SET NULL
);

INSERT INTO participants SELECT * FROM qq_migration_participants;

CREATE TABLE portal_profiles (
  user_id TEXT PRIMARY KEY,
  credit_name TEXT NOT NULL CHECK (length(trim(credit_name)) BETWEEN 1 AND 80),
  is_anonymous INTEGER NOT NULL CHECK (is_anonymous IN (0, 1)),
  contact_email TEXT,
  primary_contact_channel TEXT NOT NULL,
  primary_contact_handle TEXT NOT NULL,
  backup_contact TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL, bilibili_uid TEXT,
  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
);

INSERT INTO portal_profiles SELECT * FROM qq_migration_portal_profiles;

CREATE TABLE participant_events (
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

INSERT INTO participant_events SELECT * FROM qq_migration_participant_events;

CREATE TABLE project_drafts (
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
  updated_at TEXT NOT NULL, work_type TEXT CHECK (work_type IS NULL OR work_type IN ('text', 'illustration', 'comic', 'music', 'video', 'other')), cover_url TEXT, cover_alt TEXT, work_url TEXT, published_at TEXT CHECK (published_at IS NULL OR (preview_status = 'approved' AND review_status = 'approved')), release_confirmed_at TEXT,
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
  FOREIGN KEY (segment_id) REFERENCES schedule_segments(id) ON DELETE SET NULL
);

INSERT INTO project_drafts SELECT * FROM qq_migration_project_drafts;

CREATE TABLE segment_swap_requests (
  id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  requester_segment_id TEXT NOT NULL REFERENCES schedule_segments(id),
  recipient_segment_id TEXT NOT NULL REFERENCES schedule_segments(id),
  message TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','rejected','cancelled','expired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (requester_id <> recipient_id),
  CHECK (requester_segment_id <> recipient_segment_id)
);

INSERT INTO segment_swap_requests SELECT * FROM qq_migration_segment_swap_requests;

UPDATE schedule_segments SET current_participant_id = (SELECT current_participant_id FROM qq_migration_schedule_segments saved WHERE saved.id = schedule_segments.id);

CREATE INDEX idx_applications_status_created_at
ON applications(status, created_at DESC);

CREATE INDEX idx_applications_contact_email
ON applications(contact_email);

CREATE INDEX idx_participant_events_participant_created_at
ON participant_events(participant_id, created_at DESC);

CREATE UNIQUE INDEX uq_applications_user_id
ON applications(user_id)
WHERE user_id IS NOT NULL;

CREATE INDEX idx_portal_profiles_contact_email ON portal_profiles(contact_email);

CREATE INDEX idx_swaps_requester ON segment_swap_requests(requester_id, created_at DESC);

CREATE INDEX idx_swaps_recipient ON segment_swap_requests(recipient_id, created_at DESC);

CREATE UNIQUE INDEX uq_swaps_pending_pair ON segment_swap_requests(requester_id, recipient_id)
WHERE status = 'pending';

CREATE TRIGGER expire_swaps_on_segment_change AFTER UPDATE OF current_participant_id, status ON schedule_segments
WHEN OLD.current_participant_id IS NOT NEW.current_participant_id OR OLD.status IS NOT NEW.status
BEGIN
  UPDATE segment_swap_requests SET status = 'expired', updated_at = NEW.updated_at
  WHERE status = 'pending' AND (requester_segment_id = OLD.id OR recipient_segment_id = OLD.id);
END;

CREATE TRIGGER expire_swaps_on_participant_change AFTER UPDATE OF status ON participants
WHEN NEW.status <> 'approved'
BEGIN
  UPDATE segment_swap_requests SET status = 'expired', updated_at = NEW.updated_at
  WHERE status = 'pending' AND (requester_id = NEW.id OR recipient_id = NEW.id);
END;

CREATE TRIGGER expire_swaps_on_schedule_change AFTER UPDATE OF status ON schedule_versions
WHEN NEW.status <> 'active'
BEGIN
  UPDATE segment_swap_requests SET status = 'expired', updated_at = NEW.updated_at
  WHERE status = 'pending' AND requester_segment_id IN
    (SELECT id FROM schedule_segments WHERE schedule_version_id = NEW.id);
END;

CREATE TRIGGER expire_swaps_on_window_change AFTER UPDATE ON event_windows
WHEN NEW.key = 'segment_change_open' AND (
  NEW.is_enabled = 0 OR
  (NEW.closes_at IS NOT NULL AND julianday(NEW.closes_at) <= julianday('now')) OR
  (OLD.closes_at IS NOT NULL AND julianday(OLD.closes_at) <= julianday('now'))
)
BEGIN
  UPDATE segment_swap_requests SET status = 'expired', updated_at = NEW.updated_at
  WHERE status = 'pending';
END;

DROP TABLE qq_migration_applications;

DROP TABLE qq_migration_participants;

DROP TABLE qq_migration_portal_profiles;

DROP TABLE qq_migration_participant_events;

DROP TABLE qq_migration_project_drafts;

DROP TABLE qq_migration_segment_swap_requests;

DROP TABLE qq_migration_schedule_segments;

PRAGMA defer_foreign_keys = OFF;
