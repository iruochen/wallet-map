import type { Pool } from "pg";

const migration0002 = `
ALTER TABLE analysis_jobs
  ADD COLUMN IF NOT EXISTS progress JSONB,
  ADD COLUMN IF NOT EXISTS result_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS data_mode TEXT,
  ADD COLUMN IF NOT EXISTS chain_name TEXT,
  ADD COLUMN IF NOT EXISTS source_label TEXT,
  ADD COLUMN IF NOT EXISTS watched_address_count INTEGER,
  ADD COLUMN IF NOT EXISTS event_count INTEGER;

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_created_at ON analysis_jobs(created_at DESC);
`;

const migration0003 = `
ALTER TABLE normalized_events
  DROP CONSTRAINT IF EXISTS normalized_events_pkey;

ALTER TABLE normalized_events
  ADD CONSTRAINT normalized_events_pkey PRIMARY KEY (analysis_job_id, id);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_subject_created_at
  ON analysis_jobs(subject_id, created_at DESC);
`;

let migrationPromise: Promise<void> | undefined;

export async function ensureStorageMigrations(pool: Pool): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = runMigrations(pool);
  }

  await migrationPromise;
}

async function runMigrations(pool: Pool): Promise<void> {
  const tableCheck = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'analysis_jobs'
      ) AS exists
    `,
  );

  if (!tableCheck.rows[0]?.exists) {
    throw new Error(
      "Database schema is missing. Run packages/storage/migrations/0001_initial_schema.sql first.",
    );
  }

  await pool.query(migration0002);
  await pool.query(migration0003);
}

export function resetStorageMigrationStateForTests(): void {
  migrationPromise = undefined;
}
