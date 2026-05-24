# Development Workflow

## Goals

Development should stay boring, reviewable, and evidence-driven.

- Keep changes small enough to review.
- Add tests for behavior, not implementation trivia.
- Prefer stable domain models over quick string passing.
- Preserve user privacy and project boundaries in every feature.

## Local Setup

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm lint
pnpm dev
```

The web app runs at:

```text
http://localhost:3000
```

## Before Starting A Change

1. Read the relevant package and nearby tests.
2. Decide which layer owns the change:
   - `packages/core`: shared types, graph primitives, scoring primitives.
   - `packages/adapters`: external data source and chain ingestion boundaries.
   - `packages/analyzers`: relationship detection rules.
   - `packages/exporters`: report output formats.
   - `apps/web`: user interface and interaction flow.
3. Check whether the change needs a fixture.
4. Update docs when the behavior or project boundary changes.

## Definition Of Done

A change is done when:

- `pnpm typecheck` passes.
- `pnpm test` passes.
- `pnpm lint` passes.
- New behavior has focused tests or a clear reason tests are not useful yet.
- User-facing analysis results include evidence, not just a conclusion.
- Documentation is updated when the public workflow, data model, or analysis semantics change.

## Branch And PR Style

Use focused branches:

```text
feature/graph-builder
feature/etherscan-adapter
fix/scoring-confidence
docs/analysis-guidelines
```

Use commit messages from [Commit Convention](commit-convention.md).

Pull requests should include:

- What changed.
- Why it changed.
- How it was tested.
- Any privacy or analysis-boundary implications.

## Fixture Policy

Fixtures should be:

- Small.
- Public or synthetic.
- Free of private API keys.
- Easy to inspect by hand.

Prefer synthetic wallet addresses unless the fixture specifically tests behavior from a public protocol transaction.
