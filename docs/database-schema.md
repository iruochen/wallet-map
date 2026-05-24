# Database Schema

Wallet Map uses PostgreSQL as the first durable storage target. The MVP storage layer is intentionally thin: it defines SQL migrations and TypeScript repository contracts, but it does not yet include a live database client or migration runner.

## Current Boundary

- `@wallet-map/storage` owns schema files and repository interfaces.
- The web app still runs in fixture mode and does not write to PostgreSQL yet.
- API keys, wallet labels, and private local exports are not stored by this schema.
- Future database clients should implement the repository interfaces rather than leaking SQL details into UI or analyzer packages.

## Tables

### `analysis_jobs`

Stores one user-triggered analysis request.

Key fields:

- `id`: stable job identifier.
- `status`: `pending`, `running`, `completed`, or `failed`.
- `subject_id`: optional higher-level subject/entity id.
- `input_addresses`: JSON array of watched wallet addresses.
- `chain_ids`: chains included in the run.
- `score`: serialized relationship score from `runAnalysis`.
- `error_message`: failure reason when a job cannot complete.
- Timestamps for creation, updates, start, and completion.

### `normalized_events`

Stores normalized chain events used as analysis evidence.

Key fields:

- `analysis_job_id`: parent job.
- `event_type`, `chain_id`, `tx_hash`, `block_number`, `occurred_at`: event identity and ordering.
- `from_address`, `to_address`, `contract_address`, `method_id`: common query fields.
- `asset`, `amount`, `metadata`: normalized event details.
- `raw_event`: complete serialized `NormalizedEvent` so MVP fields are not lost as the model evolves.

### `graph_nodes`

Stores nodes produced by `buildRelationshipGraph`.

Key fields:

- `analysis_job_id`: parent job.
- `id`: graph node id scoped to the job.
- `node_kind`: wallet, contract, entity, or asset.
- `address`, `chain_id`, `label`, `tags`: display and filtering fields.
- `metadata`: reserved for future enrichment.

### `graph_edges`

Stores relationship edges produced by `buildRelationshipGraph` and future graph builders.

Key fields:

- `analysis_job_id`: parent job.
- `id`: graph edge id scoped to the job.
- `edge_kind`: transfer, contract interaction, shared counterparty, temporal similarity, bridge route, etc.
- `source_node_id`, `target_node_id`: composite references to `graph_nodes`.
- `weight`: edge strength.
- `evidence_event_ids`: event ids supporting the edge.
- `metadata`: serialized edge metadata.

### `findings`

Stores analyzer output from `runAnalysis`.

Key fields:

- `analysis_job_id`: parent job.
- `id`: finding id scoped to the job.
- `analyzer_id`: analyzer that emitted the finding.
- `title`, `description`, `severity`, `confidence`, `score_impact`: user-facing result fields.
- `evidence`: serialized evidence references.
- `metadata`: analyzer-specific details.

## Next Integration Points

1. Add a migration runner for local development and CI.
2. Implement a PostgreSQL-backed `WalletMapStorage`.
3. Connect `/api/analyze` so it creates a job, saves normalized events, saves graph output, and persists findings.
4. Add a job detail endpoint for replaying saved analysis results.
