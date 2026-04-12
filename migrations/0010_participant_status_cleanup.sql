PRAGMA foreign_keys = OFF;

CREATE TABLE participants_next (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE,
  application_id TEXT,
  invite_email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  contact_handle TEXT,
  status TEXT NOT NULL CHECK (
    status IN ('approved', 'withdrawn', 'completed')
  ),
  invited_at TEXT,
  activated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE SET NULL
);

INSERT INTO participants_next (
  id,
  user_id,
  application_id,
  invite_email,
  display_name,
  contact_handle,
  status,
  invited_at,
  activated_at,
  created_at,
  updated_at
)
SELECT
  id,
  user_id,
  application_id,
  invite_email,
  display_name,
  contact_handle,
  CASE
    WHEN status IN ('invited', 'active') THEN 'approved'
    ELSE status
  END,
  invited_at,
  activated_at,
  created_at,
  updated_at
FROM participants;

DROP TABLE participants;
ALTER TABLE participants_next RENAME TO participants;

PRAGMA foreign_keys = ON;
