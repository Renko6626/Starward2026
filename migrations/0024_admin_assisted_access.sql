CREATE TABLE admin_account_events (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
