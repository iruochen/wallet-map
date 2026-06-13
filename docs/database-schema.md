# Database Schema

中文版本：[database-schema.zh.md](database-schema.zh.md)

Wallet Map supports PostgreSQL as an optional durable storage target and Redis as an optional hot-cache and in-flight job-progress backend. The application can run without either service in fixture mode or in a single-instance local demo. Vercel preview and production deployments should use managed Redis for analysis job status.

## Current Boundary

- `@wallet-map/storage` owns schema files, repository interfaces, and PostgreSQL implementations.
- The web app writes analysis jobs and results through `createPostgresAnalysisStorage` only when `STORAGE_POSTGRES_ENABLED=true` and `DATABASE_URL` is configured.
- Analysis job **progress** is stored in Redis (`wallet-map:analyze-job:{id}`) only when `STORAGE_REDIS_ENABLED=true` and `REDIS_URL` is configured. Otherwise, the web app falls back to an in-memory job store.
- Completed analysis **snapshots** and normalized rows are stored in PostgreSQL for replay and history.
- Public known entity labels can be stored in `known_labels` and mirrored in Redis for fast lookup.
- The private label manager route `/labels` is disabled by default and is controlled by `NEXT_PUBLIC_LABEL_MANAGER_ENABLED`.

## Migrations

Apply in order:

1. `packages/storage/migrations/0001_initial_schema.sql`
2. `packages/storage/migrations/0002_analysis_job_metadata.sql`
3. `packages/storage/migrations/0003_scoped_event_and_job_subjects.sql`

Example (local Docker Compose):

```bash
docker-compose up -d
psql "$DATABASE_URL" -f packages/storage/migrations/0001_initial_schema.sql
psql "$DATABASE_URL" -f packages/storage/migrations/0002_analysis_job_metadata.sql
psql "$DATABASE_URL" -f packages/storage/migrations/0003_scoped_event_and_job_subjects.sql
```

## Tables

### `analysis_jobs`

Stores one user-triggered analysis request.

Key fields:

- `id`: stable job identifier.
- `status`: `pending`, `running`, `completed`, or `failed`.
- `progress`: JSON snapshot of the latest pipeline phase (also mirrored in Redis while running).
- `result_snapshot`: serialized API response for fast replay.
- `input_addresses`, `chain_ids`, `data_mode`, `chain_name`, `source_label`.
- `subject_id`: `wallet:<address>` for signed-in users or `session:<id>` for anonymous browser sessions.
- `watched_address_count`, `event_count`.
- `score`: serialized relationship score from `runAnalysis`.
- `error_message`: failure reason when a job cannot complete.
- Timestamps for creation, updates, start, and completion.

### `normalized_events`

Stores normalized chain events used as analysis evidence. Event IDs are scoped by `analysis_job_id` so repeated analyses can store the same source event without primary-key collisions.

### `graph_nodes` / `graph_edges`

Stores relationship graph output scoped to a job.

### `findings`

Stores analyzer output from `runAnalysis`.

### `known_labels`

Stores public or team-curated labels enriched from Chainbase, Etherscan nametag, static seeds, or the `/labels` local label manager.

Lookup priority in PostgreSQL favors `chainbase-address-labels`, then `etherscan-nametag`, then `known-entity-labels`, then the legacy `static-label-registry`; locally managed records use the `local-labels` source and can be searched or upserted from the web UI when `DATABASE_URL` is configured.

## API Integration

| Endpoint | Storage |
| --- | --- |
| `POST /api/analyze` | Creates Redis or in-memory job; creates PostgreSQL `analysis_jobs` when enabled |
| `GET /api/analyze/jobs/:id` | Reads Redis or in-memory job first, falls back to PostgreSQL snapshot when enabled |
| `GET /api/analyze/jobs` | Lists recent jobs from PostgreSQL when enabled |
| `GET /api/labels` | Lists records from PostgreSQL `known_labels` only when label manager is enabled |
| `POST /api/labels` | Upserts a `local-labels` record only when label manager is enabled |

## Environment

```bash
STORAGE_POSTGRES_ENABLED=true
DATABASE_URL=postgresql://...
STORAGE_REDIS_ENABLED=true
REDIS_URL=rediss://...
CHAINBASE_API_KEY=...
LABEL_DATABASE_ENABLED=true
LABEL_REDIS_CACHE_ENABLED=true
LABEL_LIST_CACHE_ENABLED=true
NEXT_PUBLIC_LABEL_MANAGER_ENABLED=false
```

On Vercel, use managed Redis such as Upstash for job progress. Use managed PostgreSQL such as Neon only when persistent history or label management is required. Do not run Docker Compose services on Vercel itself. See [Vercel Deployment](vercel-deployment.md).
