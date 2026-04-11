CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE,
  application_id TEXT,
  invite_email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  contact_handle TEXT,
  status TEXT NOT NULL CHECK (
    status IN ('invited', 'active', 'withdrawn', 'completed')
  ),
  invited_at TEXT,
  activated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE SET NULL
);
