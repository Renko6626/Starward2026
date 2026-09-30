-- Keep existing drafts unpublished; creators fill in public metadata through preview review.
ALTER TABLE project_drafts ADD COLUMN work_type TEXT CHECK (work_type IS NULL OR work_type IN ('text', 'illustration', 'comic', 'music', 'video', 'other'));
ALTER TABLE project_drafts ADD COLUMN cover_url TEXT;
ALTER TABLE project_drafts ADD COLUMN cover_alt TEXT;
ALTER TABLE project_drafts ADD COLUMN work_url TEXT;
ALTER TABLE project_drafts ADD COLUMN published_at TEXT CHECK (published_at IS NULL OR (preview_status = 'approved' AND review_status = 'approved'));
