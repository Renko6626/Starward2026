CREATE TABLE admin_roles (
  user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin')),
  granted_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX admin_single_owner ON admin_roles(role) WHERE role = 'owner';

CREATE TABLE admin_role_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('grant', 'revoke')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
