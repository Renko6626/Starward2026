ALTER TABLE schedule_segments ADD COLUMN kind TEXT NOT NULL DEFAULT 'standard'
  CHECK (kind IN ('standard', 'extra') AND (kind != 'extra' OR scheduled_at IS NULL));
