CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
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
);
