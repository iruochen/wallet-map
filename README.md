# Wallet Map

Wallet Map is a local-first wallet relationship analysis toolkit.

It helps users inspect visible on-chain links between two or more wallets:

- direct transfers
- shared counterparties
- multi-hop paths
- shared contract interactions
- time-adjacent behavior patterns

The project is designed for personal chain-footprint audits, research, and compliance-friendly analysis. It does not handle private keys, signatures, or automated wallet operations.

## Workspace

```text
apps/
  web/                 Next.js UI
packages/
  core/                Shared domain models, graph types, scoring primitives
  adapters/            Data-source and chain adapter interfaces
  analyzers/           Relationship analyzer plugins
  exporters/           Report/export interfaces
  storage/             Persistence contracts and SQL migrations
agents/                Parallel agent task records
docs/
  architecture-map.md  Product and architecture map
fixtures/              Public sample datasets for tests and demos
```

## Commands

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm dev
```

## Environment

Copy the example file before local development:

```bash
cp .env.example .env.local
cp apps/web/.env.example apps/web/.env.local
```

Do not commit real `.env` files, API keys, RPC URLs with credentials, or private wallet data.

The Next.js app reads runtime secrets from `apps/web/.env.local`.

## Local Infrastructure

This project uses Docker Compose for local PostgreSQL and Redis.

If you use Colima on macOS:

```bash
colima start
docker-compose up -d
```

Check services:

```bash
docker-compose ps
```

Stop services:

```bash
docker-compose down
```

Remove local database and Redis data:

```bash
docker-compose down -v
```

## Database Migrations

After PostgreSQL is running, apply:

```bash
psql "$DATABASE_URL" -f packages/storage/migrations/0001_initial_schema.sql
psql "$DATABASE_URL" -f packages/storage/migrations/0002_analysis_job_metadata.sql
```

Analysis jobs persist to PostgreSQL; in-flight progress is stored in Redis when
`REDIS_URL` is configured. Open `/history` to replay completed runs or compare
two completed jobs by score, confidence, event count, and source.

Known labels also use PostgreSQL. Open `/labels` to add or update local
address labels stored in `known_labels` with the `local-labels` source. These
records are read by the analysis label stack when `DATABASE_URL` is configured
and `LABEL_DATABASE_ENABLED` is not set to `false`.

The analysis label stack also includes a built-in `known-entity-labels`
provider for public services such as exchange hot wallets, bridges, DEX
contracts, infrastructure, and canonical token contracts. Live Chainbase and
Etherscan nametag providers can enrich or override those seeds when configured,
and `normalized-event-asset` labels fill in token symbols from analyzed events.

## MVP Flow

The current MVP runs in fixture mode:

- Open the workbench with `pnpm dev`.
- Use the sample wallet addresses on the homepage.
- Submit the analysis form.
- The app calls `/api/analyze`, builds a relationship graph, runs the default analyzers, and returns findings with evidence.
- Address import accepts `.txt`, `.csv`, and `.tsv` files, deduplicates EVM addresses, and reports invalid rows before analysis.

Data source modes:

- `Auto`: uses live Etherscan API V2 data only when `ETHERSCAN_API_KEY` is present, otherwise falls back to fixture data.
- `Fixture`: always uses `fixtures/sample-events.json`.
- `Live`: requires the relevant scan API key and returns a clear error if it is missing.

Provider API keys can stay empty while developing in fixture mode.
Live mode fetches wallet addresses with a small concurrency guard. Set
`ANALYZE_LIVE_ADDRESS_CONCURRENCY` in `apps/web/.env.local` to tune this value;
it defaults to `2` and is capped at `8` to reduce provider rate-limit pressure.
Each live provider HTTP request also has a timeout guard. Set
`ANALYZE_LIVE_PROVIDER_TIMEOUT_MS` to tune it; it defaults to `30000` and is
capped at `120000`. When a primary provider times out, Auto provider mode uses
the configured fallback provider for supported chains.
In `Auto` provider mode, EVM chains use NodeReal first when it supports the
selected chain and a NodeReal key is configured, with Etherscan V2 as the
fallback when an Etherscan key is also available. Explicit Etherscan selection
still uses Etherscan V2 first, but can fall back to NodeReal on supported EVM
chains when a NodeReal key is configured. Solana uses Solscan when
`SOLSCAN_API_KEY` is configured.

With `ETHERSCAN_API_KEY` configured locally, the current live pipeline supports:

- Ethereum (`chainId=1`)
- Arbitrum (`chainId=42161`)
- Base (`chainId=8453`)
- BSC (`chainId=56`)

The adapter currently ingests:

- native transfers
- internal native transfers
- ERC20 transfers
- ERC721 transfers

Completed runs can be exported from the workbench summary panel as PDF,
Markdown, JSON, or CSV evidence files. Markdown is intended for human review,
JSON for secondary analysis, CSV for spreadsheet review, and PDF for shareable
audit snapshots.

## Product Tiers

The workbench now exposes a typed product boundary so capacity, history, export,
provider, and label behavior can be gated consistently as Wallet Map moves
toward a professional edition:

- `Anonymous`: session-scoped trial with optional anonymous analysis limits,
  capped at 10 addresses per analysis request.
- `Free`: signed-in personal workspace with wallet-scoped history replay,
  capped at 25 addresses per analysis request.
- `Pro`: larger async batches up to 100 addresses, extended history,
  multi-provider depth, report templates, and private label sets.
- `Team`: shared review, label governance, managed retention, deployment
  controls, and up to 200 addresses per analysis request.

The current UI shows the active plan boundary beside analysis setup. The model
lives in `apps/web/app/pro-plan.ts` and `/api/analyze` enforces the matching
address-count and request-size limits before creating a job.

## Project Docs

- [Architecture Map](docs/architecture-map.md)
- [Development Workflow](docs/development-workflow.md)
- [Code Style](docs/code-style.md)
- [Commit Convention](docs/commit-convention.md)
- [Documentation Style](docs/documentation-style.md)
- [Database Schema](docs/database-schema.md)
- [Graph Visualization](docs/graph-visualization.md)
- [Product Design Roadmap](docs/product-design-roadmap.zh.md)
- [Analysis Guidelines](docs/analysis-guidelines.md)
- [Open Source Guidelines](docs/open-source.md)
- [Release Process](docs/release-process.md)
- [Project Readiness](docs/project-readiness.md)
- [Contributing](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Parallel Agent Work](agents/README.md)
