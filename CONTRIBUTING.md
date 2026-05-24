# Contributing

Thanks for helping build Wallet Map.

## Quick Start

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm lint
pnpm dev
```

## Read First

- [Architecture Map](docs/architecture-map.md)
- [Development Workflow](docs/development-workflow.md)
- [Code Style](docs/code-style.md)
- [Commit Convention](docs/commit-convention.md)
- [Documentation Style](docs/documentation-style.md)
- [Analysis Guidelines](docs/analysis-guidelines.md)
- [Open Source Guidelines](docs/open-source.md)
- [Release Process](docs/release-process.md)
- [Project Readiness](docs/project-readiness.md)

## What Good Contributions Look Like

- Small, focused changes.
- Tests for new behavior.
- Evidence-backed analysis output.
- Clear docs when public behavior changes.
- No private keys, seed phrases, API keys, or sensitive wallet data in commits.

## Commit Messages

Use the lightweight Conventional Commits style from [Commit Convention](docs/commit-convention.md):

```text
feat(core): add graph builder
fix(adapters): handle empty csv rows
docs: add security policy
```

## Package Boundaries

```text
apps/web -> packages/*
packages/adapters -> packages/core
packages/analyzers -> packages/core
packages/exporters -> packages/core
packages/core -> no project packages
```

Keep fetching logic in adapters and detection logic in analyzers.

## Pull Request Checklist

- [ ] I ran `pnpm typecheck`.
- [ ] I ran `pnpm test`.
- [ ] I ran `pnpm lint`.
- [ ] I added or updated tests where useful.
- [ ] I updated docs for public behavior or analysis changes.
- [ ] I did not commit secrets or private wallet data.
