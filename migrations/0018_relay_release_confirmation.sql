-- Author confirmation is independent of public archive publication.
ALTER TABLE project_drafts ADD COLUMN release_confirmed_at TEXT;
