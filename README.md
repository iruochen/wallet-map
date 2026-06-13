# Wallet Map

Wallet Map is a local-first wallet relationship analysis workbench for reviewing public on-chain evidence across wallet address groups.

It helps users inspect visible relationship signals such as direct transfers, shared counterparties, multi-hop paths, shared contract interactions, and time-adjacent activity patterns. The project is designed for personal chain-footprint audits, public-data research, and compliance-friendly review workflows.

Wallet Map does not handle private keys, seed phrases, signatures, custody, transaction submission, or automated wallet operations.

中文文档入口见 [README.zh.md](README.zh.md). Documentation is maintained in English and Chinese; see [Project Docs](#project-docs).

## Preview

![Wallet Map workbench](docs/assets/wallet-map-home.png)

Live application: [https://wm.ruochen.app](https://wm.ruochen.app)

## Features

- Address-group analysis for EVM wallets.
- Interactive workbench with address input, progress tracking, graph exploration, evidence review, and report export.
- Synthetic fixture mode for local demos, tests, and contributor onboarding without private API keys.
- Live EVM ingestion through Etherscan-like providers, with NodeReal and Solscan provider hooks.
- Relationship graph construction, default analyzer plugins, multidimensional exposure scoring, and evidence-backed findings.
- Report export as PDF, Markdown, JSON, and CSV.
- Optional PostgreSQL persistence for history and replay.
- Optional Redis job state for serverless deployments.
- Private label manager route, disabled by default.

## Workspace

```text
apps/
  web/                 Next.js application and API routes
packages/
  core/                Domain models, graph contracts, scoring primitives
  adapters/            Chain and data-source adapters
  analyzers/           Relationship analyzer plugins
  exporters/           Report exporters
  labels/              Label providers and enrichment
  storage/             Persistence contracts and SQL migrations
docs/                  Bilingual project documentation
fixtures/              Synthetic sample datasets for tests and demos
```

## Quick Start

```bash
pnpm install
pnpm dev
```

Open the local app and run an analysis with the sample addresses in fixture mode. Fixture mode uses `fixtures/sample-events.json` and does not require API keys, PostgreSQL, or Redis.

Useful checks:

```bash
pnpm typecheck
pnpm test
pnpm --filter @wallet-map/web build
```

## Configuration

Copy the example files before local development:

```bash
cp .env.example .env.local
cp apps/web/.env.example apps/web/.env.local
```

Do not commit real `.env` files, API keys, RPC URLs with credentials, private wallet data, or user-provided wallet addresses.

### Data Sources

- `Auto`: uses live provider data when configured, otherwise falls back to fixture data.
- `Fixture`: always uses the synthetic sample dataset.
- `Live`: requires the selected provider credentials and returns a clear error when missing.

Provider environment variables include `ETHERSCAN_API_KEY`, `NODEREAL_API_KEY`, `NODEREAL_BSC_API_KEY`, `SOLSCAN_API_KEY`, and `CHAINBASE_API_KEY`.

### Storage

PostgreSQL and Redis are optional for local development.

Redis is recommended for Vercel preview and production deployments so analysis job state can survive across serverless function instances. The job store supports Upstash REST variables and Redis protocol URLs:

```bash
STORAGE_REDIS_ENABLED=true
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
# or REDIS_URL=rediss://...
```

PostgreSQL is required only for persisted history, replay, and database-backed label management:

```bash
STORAGE_POSTGRES_ENABLED=true
DATABASE_URL=postgresql://...
pnpm db:migrate
```

The label manager is disabled unless explicitly enabled:

```bash
NEXT_PUBLIC_LABEL_MANAGER_ENABLED=false
```

## Deployment

The production deployment is hosted on Vercel:

- App: [https://wm.ruochen.app](https://wm.ruochen.app)
- Build command: `pnpm --filter @wallet-map/web build`
- Install command: `pnpm install --frozen-lockfile`
- Output directory: `apps/web/.next`

See [Vercel Deployment](docs/vercel-deployment.md) for environment variables and managed Redis guidance.

## Project Docs

- Overview: [English](docs/README.md), [中文](docs/README.zh.md)
- Architecture Map: [English](docs/architecture-map.en.md), [中文](docs/architecture-map.md)
- Development Workflow: [English](docs/development-workflow.md), [中文](docs/development-workflow.zh.md)
- Code Style: [English](docs/code-style.md), [中文](docs/code-style.zh.md)
- Commit Convention: [English](docs/commit-convention.md), [中文](docs/commit-convention.zh.md)
- Documentation Style: [English](docs/documentation-style.md), [中文](docs/documentation-style.zh.md)
- Database Schema: [English](docs/database-schema.md), [中文](docs/database-schema.zh.md)
- Vercel Deployment: [English](docs/vercel-deployment.md), [中文](docs/vercel-deployment.zh.md)
- Analysis Guidelines: [English](docs/analysis-guidelines.md), [中文](docs/analysis-guidelines.zh.md)
- Open Source Guidelines: [English](docs/open-source.md), [中文](docs/open-source.zh.md)
- Release Process: [English](docs/release-process.md), [中文](docs/release-process.zh.md)
- Contributing: [English](CONTRIBUTING.md), [中文](CONTRIBUTING.zh.md)
- Security Policy: [English](SECURITY.md), [中文](SECURITY.zh.md)
- Code of Conduct: [English](CODE_OF_CONDUCT.md), [中文](CODE_OF_CONDUCT.zh.md)
- Changelog: [English](CHANGELOG.md), [中文](CHANGELOG.zh.md)
