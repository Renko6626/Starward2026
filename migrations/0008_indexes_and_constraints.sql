CREATE INDEX IF NOT EXISTS idx_applications_status_created_at
ON applications(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_applications_contact_email
ON applications(contact_email);

CREATE INDEX IF NOT EXISTS idx_schedule_segments_status_sort_order
ON schedule_segments(status, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_participant_events_participant_created_at
ON participant_events(participant_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_schedule_versions_active
ON schedule_versions(status)
WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS uq_schedule_segments_version_code
ON schedule_segments(schedule_version_id, code);

CREATE UNIQUE INDEX IF NOT EXISTS uq_schedule_segments_version_sort_order
ON schedule_segments(schedule_version_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS uq_schedule_segments_current_participant
ON schedule_segments(schedule_version_id, current_participant_id)
WHERE current_participant_id IS NOT NULL
  AND status = 'held';
