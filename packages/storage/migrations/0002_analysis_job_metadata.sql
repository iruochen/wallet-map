ALTER TABLE analysis_jobs
  ADD COLUMN IF NOT EXISTS progress JSONB,
  ADD COLUMN IF NOT EXISTS result_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS data_mode TEXT,
  ADD COLUMN IF NOT EXISTS chain_name TEXT,
  ADD COLUMN IF NOT EXISTS source_label TEXT,
  ADD COLUMN IF NOT EXISTS watched_address_count INTEGER,
  ADD COLUMN IF NOT EXISTS event_count INTEGER;

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_created_at ON analysis_jobs(created_at DESC);
