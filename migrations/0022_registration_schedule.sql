-- Preserve assignments, drafts and swap requests while extending timed private seats.

PRAGMA defer_foreign_keys = ON;

CREATE TABLE schedule_migration_draft_links AS SELECT id, segment_id FROM project_drafts;

DROP TRIGGER expire_swaps_on_segment_change;

DROP TRIGGER expire_swaps_on_schedule_change;

CREATE TABLE schedule_segments_new (
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
  updated_at TEXT NOT NULL, scheduled_at TEXT, kind TEXT NOT NULL DEFAULT 'standard'
  CHECK (kind IN ('standard', 'extra', 'special') AND (kind != 'extra' OR scheduled_at IS NULL) AND (kind != 'special' OR scheduled_at IS NOT NULL)),
  FOREIGN KEY (schedule_version_id) REFERENCES schedule_versions(id) ON DELETE CASCADE,
  FOREIGN KEY (current_participant_id) REFERENCES participants(id) ON DELETE SET NULL
);

INSERT INTO schedule_segments_new SELECT * FROM schedule_segments;

DROP TABLE schedule_segments;

ALTER TABLE schedule_segments_new RENAME TO schedule_segments;

UPDATE project_drafts SET segment_id = (SELECT segment_id FROM schedule_migration_draft_links saved WHERE saved.id = project_drafts.id);

DROP TABLE schedule_migration_draft_links;

CREATE INDEX idx_schedule_segments_status_sort_order
ON schedule_segments(status, sort_order ASC);

CREATE UNIQUE INDEX uq_schedule_segments_version_code
ON schedule_segments(schedule_version_id, code);

CREATE UNIQUE INDEX uq_schedule_segments_version_sort_order
ON schedule_segments(schedule_version_id, sort_order);

CREATE UNIQUE INDEX uq_schedule_segments_current_participant
ON schedule_segments(schedule_version_id, current_participant_id)
WHERE current_participant_id IS NOT NULL
  AND status IN ('held', 'locked', 'completed');

CREATE TRIGGER expire_swaps_on_segment_change AFTER UPDATE OF current_participant_id, status, scheduled_at ON schedule_segments
WHEN OLD.current_participant_id IS NOT NEW.current_participant_id OR OLD.status IS NOT NEW.status OR OLD.scheduled_at IS NOT NEW.scheduled_at
BEGIN
  UPDATE segment_swap_requests SET status = 'expired', updated_at = NEW.updated_at
  WHERE status = 'pending' AND (requester_segment_id = OLD.id OR recipient_segment_id = OLD.id);
END;

CREATE TRIGGER expire_swaps_on_schedule_change AFTER UPDATE OF status ON schedule_versions
WHEN NEW.status <> 'active'
BEGIN
  UPDATE segment_swap_requests SET status = 'expired', updated_at = NEW.updated_at
  WHERE status = 'pending' AND requester_segment_id IN
    (SELECT id FROM schedule_segments WHERE schedule_version_id = NEW.id);
END;

-- Repair missing draft links from the first approval path.

UPDATE project_drafts SET segment_id = (SELECT s.id FROM schedule_segments s JOIN schedule_versions v ON v.id=s.schedule_version_id AND v.status='active' WHERE s.current_participant_id=project_drafts.participant_id AND s.status IN ('held','locked','completed')) WHERE segment_id IS NULL;

PRAGMA defer_foreign_keys = OFF;
