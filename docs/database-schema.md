# Database Schema

Wallet Map uses PostgreSQL as the durable storage target and Redis for hot caches and in-flight analysis job progress.

## Current Boundary

- `@wallet-map/storage` owns schema files, repository interfaces, and PostgreSQL implementations.
- The web app writes analysis jobs and results through `createPostgresAnalysisStorage`.
- Analysis job **progress** is stored in Redis (`wallet-map:analyze-job:{id}`) for multi-instance polling.
- Completed analysis **snapshots** and normalized rows are stored in PostgreSQL for replay and history.
- Public known entity labels are stored in `known_labels` and mirrored in Redis for fast lookup.

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
| `POST /api/analyze` | Creates Redis job + PostgreSQL `analysis_jobs` row |
| `GET /api/analyze/jobs/:id` | Reads Redis first, falls back to PostgreSQL snapshot |
| `GET /api/analyze/jobs` | Lists recent jobs from PostgreSQL |
| `GET /api/labels` | Lists records from PostgreSQL `known_labels` |
| `POST /api/labels` | Upserts a `local-labels` record into PostgreSQL `known_labels` |

## Environment

```bash
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
CHAINBASE_API_KEY=...
LABEL_DATABASE_ENABLED=true
LABEL_REDIS_CACHE_ENABLED=true
```

On Vercel, use managed PostgreSQL and Redis (for example Neon + Upstash). Do not run Docker Compose services on Vercel itself.
