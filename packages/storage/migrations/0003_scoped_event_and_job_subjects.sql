ALTER TABLE normalized_events
  DROP CONSTRAINT IF EXISTS normalized_events_pkey;

ALTER TABLE normalized_events
  ADD CONSTRAINT normalized_events_pkey PRIMARY KEY (analysis_job_id, id);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_subject_created_at
  ON analysis_jobs(subject_id, created_at DESC);
