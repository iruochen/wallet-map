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
- Graph visualization tool-selection and scaling plan.
- Storage package contracts and initial PostgreSQL schema migration.
- Etherscan-like adapter with mocked tests.
- Shared counterparty and same-contract interaction analyzers.
- Expanded JSON and Markdown exporters with address redaction.
- Parallel agent task records.
- Project documentation for development, code style, analysis, open source, and environment safety.
