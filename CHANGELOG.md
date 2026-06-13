# Changelog

All notable changes to Wallet Map will be documented in this file.

The format follows Keep a Changelog loosely, and the project uses semantic versioning.

## Unreleased

### Added

- Initial TypeScript monorepo scaffold.
- Local Docker Compose setup for PostgreSQL and Redis.
- Core normalized event, graph, finding, scoring, and analysis pipeline types.
- First direct transfer analyzer.
- Fixture-mode web workbench and `/api/analyze` endpoint.
- Auto/live analysis data-source selection for Etherscan-like adapters.
- Expanded fixture data to exercise direct transfers, shared counterparties, and same-contract interactions.
- Improved workbench loading, error, empty, and result states.
- Etherscan API V2 live mode using one API key plus `chainid`.
- Live-mode support for Ethereum, Arbitrum, Base, and BSC with throttled Etherscan V2 fetching, internal transfers, ERC20, and ERC721 ingestion.
- Storage package contracts and initial PostgreSQL schema migration.
- Etherscan-like adapter with mocked tests.
- Shared counterparty and same-contract interaction analyzers.
- Expanded JSON and Markdown exporters with address redaction.
- Project documentation for development, code style, analysis, open source, and environment safety.
- Result metadata and UI updates for live-vs-fixture status, chain support, and graph/evidence previews on large responses.
- English and Chinese documentation entry points for README, docs, and governance files.

### Changed

- PostgreSQL, Redis, label persistence, label cache, and the private label manager can be explicitly enabled or disabled through environment flags.
- Example environment files now default to storage-free fixture mode for local evaluation and Vercel previews without managed PostgreSQL/Redis.
- The `/labels` manager is disabled by default and only opens when `NEXT_PUBLIC_LABEL_MANAGER_ENABLED=true`.
