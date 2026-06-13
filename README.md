# Wallet Map

Wallet Map is a local-first wallet relationship analysis toolkit for EVM address groups.

It helps users inspect visible on-chain links between two or more wallets:

- direct transfers
- shared counterparties
- multi-hop paths
- shared contract interactions
- time-adjacent behavior patterns

The project is designed for personal chain-footprint audits, public-data research, and compliance-friendly review workflows. It does not handle private keys, signatures, custody, or automated wallet operations.

中文文档入口见 [README.zh.md](README.zh.md)。Documentation is maintained in English and Chinese; see [Project Docs](#project-docs).

## Current Status

Wallet Map is pre-1.0 and suitable for local evaluation, fixture-mode demos, and early contributor review.

Implemented capabilities include:

- Next.js workbench with address input, progress, graph view, evidence, history, and report export.
- Synthetic fixture mode that requires no private API keys or infrastructure.
- Etherscan-like live ingestion for Ethereum, Arbitrum, Base, and BSC when provider keys are configured.
- NodeReal and Solscan provider hooks for supported chains.
- Core graph construction, default analyzers, multidimensional exposure scoring, and report exporters.
- Optional PostgreSQL persistence, Redis job progress/cache, and a private label manager.

Planned before a public stable release:

- CI workflow for typecheck, test, lint, and build.
- Additional live provider coverage and cache validation.
- Bilingual documentation completion and release checklist review.
- Formal security contact and dependency update policy.

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

PostgreSQL and Redis are optional. The application can run in fixture mode without either service, which is the recommended default for first-time setup and Vercel deployments that do not yet have managed storage.

Enable local PostgreSQL and Redis only when you want persisted history, multi-instance job progress, Redis-backed label cache, or private label management.

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

Analysis jobs persist to PostgreSQL only when `STORAGE_POSTGRES_ENABLED=true`
and `DATABASE_URL` is configured. In-flight progress is stored in Redis only
when `STORAGE_REDIS_ENABLED=true` and `REDIS_URL` is configured; otherwise the
web app uses an in-memory job store suitable for a single local or preview
instance.

Known labels use PostgreSQL only when `LABEL_DATABASE_ENABLED=true`. The
private label manager route `/labels` is hidden and returns 404 unless
`NEXT_PUBLIC_LABEL_MANAGER_ENABLED=true`. Keep it disabled for public
deployments unless the maintainer intends to manage labels through the app.

The analysis label stack also includes a built-in `known-entity-labels`
provider for public services such as exchange hot wallets, bridges, DEX
contracts, infrastructure, and canonical token contracts. Live Chainbase and
Etherscan nametag providers can enrich or override those seeds when configured,
and `normalized-event-asset` labels fill in token symbols from analyzed events.

## MVP Flow

The current MVP can run fully in fixture mode without private configuration:

- Open the workbench with `pnpm dev`.
- Use the sample wallet addresses on the homepage.
- Submit the analysis form.
- The app calls `/api/analyze`, builds a relationship graph, runs the default analyzers, and returns findings with evidence.
- Address import accepts `.txt`, `.csv`, and `.tsv` files, deduplicates EVM addresses, and reports invalid rows before analysis.

`fixtures/sample-events.json` is a synthetic public demo dataset. It intentionally
uses placeholder addresses and covers direct transfers, shared funding,
shared withdrawal destinations, same-contract interactions, multi-hop transfer
paths, temporal patterns, and bridge correlation signals.

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

- Overview: [English](docs/README.md), [中文](docs/README.zh.md)
- Architecture Map: [English](docs/architecture-map.en.md), [中文](docs/architecture-map.md)
- Development Workflow: [English](docs/development-workflow.md), [中文](docs/development-workflow.zh.md)
- Code Style: [English](docs/code-style.md), [中文](docs/code-style.zh.md)
- Commit Convention: [English](docs/commit-convention.md), [中文](docs/commit-convention.zh.md)
- Documentation Style: [English](docs/documentation-style.md), [中文](docs/documentation-style.zh.md)
- Database Schema: [English](docs/database-schema.md), [中文](docs/database-schema.zh.md)
- Graph Visualization: [English](docs/graph-visualization.md), [中文](docs/graph-visualization.zh.md)
- Product Design Roadmap: [English](docs/product-design-roadmap.md), [中文](docs/product-design-roadmap.zh.md)
- Analysis Guidelines: [English](docs/analysis-guidelines.md), [中文](docs/analysis-guidelines.zh.md)
- Open Source Guidelines: [English](docs/open-source.md), [中文](docs/open-source.zh.md)
- Release Process: [English](docs/release-process.md), [中文](docs/release-process.zh.md)
- Project Readiness: [English](docs/project-readiness.md), [中文](docs/project-readiness.zh.md)
- Contributing: [English](CONTRIBUTING.md), [中文](CONTRIBUTING.zh.md)
- Security Policy: [English](SECURITY.md), [中文](SECURITY.zh.md)
- Code of Conduct: [English](CODE_OF_CONDUCT.md), [中文](CODE_OF_CONDUCT.zh.md)
- Changelog: [English](CHANGELOG.md), [中文](CHANGELOG.zh.md)
- Parallel Agent Work: [English](agents/README.md), [中文](agents/README.zh.md)
