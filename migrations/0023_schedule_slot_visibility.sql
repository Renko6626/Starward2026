-- Keep existing slots visible; visibility never changes assignment or publication.
ALTER TABLE schedule_segments ADD COLUMN is_visible INTEGER NOT NULL DEFAULT 1
  CHECK (is_visible IN (0, 1));
