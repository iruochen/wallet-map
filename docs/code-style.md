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

## Frontend Module Layout

Organize `apps/web/components/<domain>/` by responsibility. Use `components/analysis/` as the canonical example.

```text
components/analysis/
  index.ts          # narrow barrel for page-level imports
  types.ts          # shared domain types
  workbench/        # page orchestration and primary panels
  evidence/         # focused UI for one workflow area
  lib/              # pure helpers, formatters, restore logic
    foo.ts
    foo.test.ts     # colocated tests
```

Guidelines:

- Put pure logic, formatting, download helpers, and state restore code in `lib/`.
- Put orchestration components in `workbench/` or a similarly named UI subfolder.
- Put reusable UI fragments for one sub-area in a feature subfolder such as `evidence/`.
- Keep shared types at the domain root as `types.ts`.
- Export only what pages or other domains need from `index.ts`.
- Colocate Vitest files with the module they test (`foo.ts` + `foo.test.ts` in the same folder).
- Keep React components under roughly 350 lines. Split helpers and subcomponents before adding more behavior.
- Do not place API helpers under `components/`. Shared app utilities belong in `apps/web/lib/`.
- Apply the same `lib/` pattern to other domains when they grow, for example `graph/lib/`, `history/lib/`, and `labels/lib/`.

## Package Layout

Keep `packages/<name>/src/` flat unless a package clearly needs subfolders.

```text
packages/analyzers/src/
  direct-transfer.ts
  direct-transfer.test.ts
  index.ts          # narrow public exports
```

Guidelines:

- Colocate package tests with source files.
- Keep `index.ts` as a narrow export surface.
- Split files that grow past roughly 350 lines before adding more behavior.
- Domain logic stays in `packages/*`; route handlers and UI should orchestrate rather than reimplement it.

## Responsive and Mobile Layout

The app uses one UI codebase with adaptive layout shells. Do not build a separate mobile route tree or duplicate business logic.

Breakpoints (defined in `apps/web/app/styles.css`):

- `--bp-mobile: 768px` — phone layout with bottom app navigation and single-panel workbench tabs.
- `--bp-tablet: 1040px` — stacked workbench columns on medium widths.
- `--bp-desktop: 1200px` — full three-column workbench.

Mobile patterns:

- App shell: bottom nav (`AppMobileNav`) for `/`, `/history`, `/labels`; top header keeps brand, locale, and wallet controls.
- Workbench: `WorkbenchMobileTabs` switches Input / Graph / Evidence panels; running analysis auto-opens Graph; completion shows a light hint to open Evidence.
- Controls: use `mobileOnly` `<select>` controls instead of cramped segmented buttons; hide desktop segmented controls with `desktopOnly`.
- History: card list on mobile (`historyCardList`), table on desktop (`historyTable desktopOnly`).
- Graph: collapsible toolbar via `graphToolbarCollapsed` / `graphToolbarExpanded`; preserve Cytoscape pan/zoom on touch.
- Utilities: `desktopOnly` and `mobileOnly` classes; prefer `100dvh` and `env(safe-area-inset-*)` for viewport height.

When adding a new page or panel, verify `390×844` and `360×800` viewports in addition to desktop layouts.

## UI Style

The UI should feel like an analysis workbench, not a marketing page.

- Start with the workflow, not a landing page.
- Keep controls visible and predictable.
- Show evidence close to each conclusion.
- Avoid decorative elements that compete with the graph or tables.
- Prefer compact, scannable layouts for repeated analysis.

