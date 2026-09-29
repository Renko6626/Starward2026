-- Hard cut: old profile names and credit modes are intentionally discarded.
DROP TABLE portal_profiles;
CREATE TABLE portal_profiles (
  user_id TEXT PRIMARY KEY,
  credit_name TEXT NOT NULL CHECK (length(trim(credit_name)) BETWEEN 1 AND 80),
  is_anonymous INTEGER NOT NULL CHECK (is_anonymous IN (0, 1)),
  contact_email TEXT NOT NULL,
  primary_contact_channel TEXT NOT NULL,
  primary_contact_handle TEXT NOT NULL,
  backup_contact TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
);
CREATE INDEX idx_portal_profiles_contact_email ON portal_profiles(contact_email);
ALTER TABLE applications DROP COLUMN display_name;
ALTER TABLE participants DROP COLUMN display_name;
ALTER TABLE project_drafts DROP COLUMN public_author_name;
