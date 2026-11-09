-- Showcase content is curated independently from private submission archives.
ALTER TABLE schedule_versions ADD COLUMN is_frozen INTEGER NOT NULL DEFAULT 0 CHECK (is_frozen IN (0,1));

CREATE TABLE work_presentations (
  segment_id TEXT PRIMARY KEY REFERENCES schedule_segments(id),
  draft_id TEXT NOT NULL UNIQUE REFERENCES project_drafts(id),
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  work_type TEXT CHECK (work_type IN ('text','illustration','comic','music','video','cosplay','other')),
  thumbnail_id TEXT,
  thumbnail_alt TEXT NOT NULL DEFAULT '',
  legacy_thumbnail_url TEXT,
  display_kind TEXT CHECK (display_kind IN ('gallery','markdown','bilibili')),
  content_json TEXT,
  source_url TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Preserve published legacy works without inventing new body content.
INSERT INTO work_presentations
  (segment_id,draft_id,title,summary,work_type,thumbnail_alt,legacy_thumbnail_url,source_url,published_at,created_at,updated_at)
SELECT d.segment_id,d.id,COALESCE(d.preview_title,''),COALESCE(d.preview_summary,''),d.work_type,
  COALESCE(d.cover_alt,''),d.cover_url,COALESCE(d.work_url,''),d.published_at,d.created_at,d.updated_at
FROM project_drafts d WHERE d.published_at IS NOT NULL AND d.segment_id IS NOT NULL;
