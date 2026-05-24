# 2026-05-24 MVP Parallel Run

## Goal

Advance Wallet Map from a fixture-mode MVP toward a more complete foundation by splitting independent module work across four agents.

The main thread owns integration, final review, full validation, and Git commits.

## Agents

### A Thread: Storage

Agent: Peirce  
Agent ID: `019e5a2d-85f8-7b43-ada6-f31984a472bc`

Write scope:

- `packages/storage/**`
- `docs/database-schema.md`
- `tsconfig.base.json`
- `pnpm-lock.yaml`

Task:

- Create `@wallet-map/storage`.
- Add SQL migration for `analysis_jobs`, `normalized_events`, `graph_nodes`, `graph_edges`, and `findings`.
- Define repository contracts for jobs and stored runs.
- Document the database schema.

Result:

- Completed and handed back to the main thread for integration.

### B Thread: Adapters

Agent: Linnaeus  
Agent ID: `019e5a2d-872e-7a40-9ad0-20afd7b19733`

Write scope:

- `packages/adapters/**`

Task:

- Implement `EtherscanLikeAdapter`.
- Normalize `txlist` and `tokentx` responses into `NormalizedEvent`.
- Mock `fetch` in tests.
- Keep API keys optional and out of fixtures.

Result:

- Completed and handed back to the main thread for integration.

### C Thread: Analyzers

Agent: Curie  
Agent ID: `019e5a2d-8956-78c0-b02b-59a1a71dc84e`

Write scope:

- `packages/analyzers/**`

Task:

- Add `SharedCounterpartyAnalyzer`.
- Add `SameContractInteractionAnalyzer`.
- Include both analyzers in `createDefaultAnalyzers`.
- Preserve `DirectTransferAnalyzer` behavior.

Result:

- Completed and handed back to the main thread for integration.

### D Thread: Exporters

Agent: Hooke  
Agent ID: `019e5a2d-8bc6-7df0-a378-9ee9b1dc3c10`

Write scope:

- `packages/exporters/**`

Task:

- Improve Markdown report structure.
- Add JSON `schemaVersion`.
- Add address redaction without redacting transaction hashes.
- Cover behavior with tests.

Result:

- Completed and handed back to the main thread for integration.

## Integration Notes

The main thread reviewed the combined worktree, ran package and full-workspace validation, added this trace document, and created the final integration commit.

## Reusable Prompt Template

```text
You are the <name> thread for Wallet Map. Work only in <write scope>.
You are not alone in the codebase: do not revert other agents' changes, and adapt to concurrent work.

Task:
- <bounded task>

Requirements:
- Make direct edits in your forked workspace.
- Add focused tests.
- Run package-level validation.
- Do not create Git commits.
- Final response must include changed files, validation commands, and integration notes.
```

