# Code Style

## Language

Use TypeScript for the core project.

- Prefer explicit exported types for public package boundaries.
- Keep internal inference where it improves readability.
- Avoid `any`; use `unknown` when data is not yet trusted.
- Keep package APIs stable and narrow.

## Naming

Use domain names consistently:

- `NormalizedEvent`: a chain event after adapter normalization.
- `RelationshipGraph`: nodes and edges used by analyzers.
- `Finding`: an analyzer result with evidence.
- `EvidenceRef`: a pointer to the source event or transaction.
- `RelationshipScore`: the final explainable score.

Use file names that match the domain concept:

```text
graph-builder.ts
direct-transfer.ts
shared-counterparty.ts
markdown-exporter.ts
```

## Package Boundaries

`packages/core` must not depend on other project packages.

Allowed dependency direction:

```text
apps/web -> packages/*
packages/exporters -> packages/core
packages/analyzers -> packages/core
packages/adapters -> packages/core
packages/core -> no project packages
```

Adapters should not import analyzers. Analyzers should not fetch external data.

## Error Handling

Use typed result objects for recoverable domain failures.

Examples:

- unsupported chain
- invalid address
- rate limited data source
- partial ingestion result

Throw only for programmer errors or truly unexpected states.

## Data Handling

External data is untrusted until normalized.

- Validate addresses before storing or analyzing.
- Preserve raw references where useful, but keep normalized fields canonical.
- Store amounts as strings to avoid precision loss.
- Keep chain IDs explicit.
- Keep timestamps in ISO 8601 UTC strings.

## Tests

Use Vitest.

Test names should describe behavior:

```ts
it("finds transfer edges between watched wallets", async () => {});
```

Prefer tests around:

- normalization
- graph construction
- analyzer findings
- scoring behavior
- export shape

Avoid snapshot tests for analysis output unless the output is intentionally a stable report format.

## UI Style

The UI should feel like an analysis workbench, not a marketing page.

- Start with the workflow, not a landing page.
- Keep controls visible and predictable.
- Show evidence close to each conclusion.
- Avoid decorative elements that compete with the graph or tables.
- Prefer compact, scannable layouts for repeated analysis.

