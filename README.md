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

## Project Docs

- [Architecture Map](docs/architecture-map.md)
- [Development Workflow](docs/development-workflow.md)
- [Code Style](docs/code-style.md)
- [Analysis Guidelines](docs/analysis-guidelines.md)
- [Open Source Guidelines](docs/open-source.md)
- [Contributing](CONTRIBUTING.md)
