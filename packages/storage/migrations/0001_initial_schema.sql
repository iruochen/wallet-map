CREATE TABLE IF NOT EXISTS analysis_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  subject_id TEXT,
  input_addresses JSONB NOT NULL,
  chain_ids INTEGER[] NOT NULL DEFAULT '{}',
  score JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS normalized_events (
  id TEXT PRIMARY KEY,
  analysis_job_id TEXT NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  tx_hash TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  from_address TEXT,
  to_address TEXT,
  contract_address TEXT,
  method_id TEXT,
  asset JSONB,
  amount TEXT,
  metadata JSONB,
  raw_event JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS graph_nodes (
  id TEXT NOT NULL,
  analysis_job_id TEXT NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
  node_kind TEXT NOT NULL,
  address TEXT,
  chain_id INTEGER,
  label TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (analysis_job_id, id)
);

CREATE TABLE IF NOT EXISTS graph_edges (
  id TEXT NOT NULL,
  analysis_job_id TEXT NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
  edge_kind TEXT NOT NULL,
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  weight DOUBLE PRECISION NOT NULL DEFAULT 1,
  evidence_event_ids TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (analysis_job_id, id),
  FOREIGN KEY (analysis_job_id, source_node_id) REFERENCES graph_nodes(analysis_job_id, id) ON DELETE CASCADE,
  FOREIGN KEY (analysis_job_id, target_node_id) REFERENCES graph_nodes(analysis_job_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS findings (
  id TEXT NOT NULL,
  analysis_job_id TEXT NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
  analyzer_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'low', 'medium', 'high')),
  confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  score_impact INTEGER NOT NULL,
  evidence JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (analysis_job_id, id)
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_normalized_events_job ON normalized_events(analysis_job_id);
CREATE INDEX IF NOT EXISTS idx_normalized_events_tx_hash ON normalized_events(chain_id, tx_hash);
CREATE INDEX IF NOT EXISTS idx_normalized_events_addresses ON normalized_events(chain_id, from_address, to_address);
CREATE INDEX IF NOT EXISTS idx_graph_edges_job ON graph_edges(analysis_job_id);
CREATE INDEX IF NOT EXISTS idx_findings_job ON findings(analysis_job_id);
