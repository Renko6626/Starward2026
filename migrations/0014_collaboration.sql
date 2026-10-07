-- A failed precondition aborts the entire D1 batch; successful guards are deleted
-- in the same batch, so this table never retains operation state.
CREATE TABLE collaboration_guards (
  id TEXT PRIMARY KEY,
  valid INTEGER NOT NULL CHECK (valid = 1)
);

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
CREATE INDEX idx_swaps_requester ON segment_swap_requests(requester_id, created_at DESC);
CREATE INDEX idx_swaps_recipient ON segment_swap_requests(recipient_id, created_at DESC);
CREATE UNIQUE INDEX uq_swaps_pending_pair ON segment_swap_requests(requester_id, recipient_id)
WHERE status = 'pending';

-- Invalidation happens at the mutation itself, even if the original slot is
-- later reclaimed. It also covers admin edits and legacy segment endpoints.
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

-- Closing a window or passing its old cutoff invalidates outstanding requests.
-- Reopening later cannot restore them.
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
