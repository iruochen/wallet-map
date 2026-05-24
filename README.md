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
```

Do not commit real `.env` files, API keys, RPC URLs with credentials, or private wallet data.

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

## MVP Flow

The current MVP runs in fixture mode:

- Open the workbench with `pnpm dev`.
- Use the sample wallet addresses on the homepage.
- Submit the analysis form.
- The app calls `/api/analyze`, builds a relationship graph, runs the default analyzers, and returns findings with evidence.

Data source modes:

- `Auto`: uses live Etherscan-like data only when the relevant API key is present, otherwise falls back to fixture data.
- `Fixture`: always uses `fixtures/sample-events.json`.
- `Live`: requires the relevant scan API key and returns a clear error if it is missing.

Provider API keys can stay empty while developing in fixture mode.

## Project Docs

- [Architecture Map](docs/architecture-map.md)
- [Development Workflow](docs/development-workflow.md)
- [Code Style](docs/code-style.md)
- [Commit Convention](docs/commit-convention.md)
- [Documentation Style](docs/documentation-style.md)
- [Database Schema](docs/database-schema.md)
- [Analysis Guidelines](docs/analysis-guidelines.md)
- [Open Source Guidelines](docs/open-source.md)
- [Release Process](docs/release-process.md)
- [Project Readiness](docs/project-readiness.md)
- [Contributing](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Parallel Agent Work](agents/README.md)
