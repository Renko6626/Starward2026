CREATE TABLE IF NOT EXISTS portal_profiles (
  user_id TEXT PRIMARY KEY,
  pen_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  primary_contact_channel TEXT NOT NULL,
  primary_contact_handle TEXT NOT NULL,
  backup_contact TEXT,
  public_credit_mode TEXT NOT NULL CHECK (
    public_credit_mode IN ('named', 'pseudonymous', 'anonymous')
  ),
  public_credit_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
);

ALTER TABLE applications ADD COLUMN user_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_applications_user_id
ON applications(user_id)
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_portal_profiles_contact_email
ON portal_profiles(contact_email);
