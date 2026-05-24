# Parallel Agent Work

This directory records parallel Codex agent work so implementation history stays traceable.

Use this pattern when work can be split into independent write scopes. The main thread remains responsible for:

- defining ownership boundaries
- launching or handing out prompts
- reviewing results
- integrating changes
- running full gates
- creating the final Git commit

## Rules

- Each agent must have a disjoint write scope.
- Agents must not commit directly.
- Agents must not revert changes from other agents.
- Agents must report changed files, validation commands, and integration notes.
- The main thread owns README, CHANGELOG, and cross-package integration unless explicitly delegated.

## Current Run

- [2026-05-24 MVP parallel run](2026-05-24-mvp-parallel-run.md)
- [2026-05-24 graph visualization thread](2026-05-24-graph-visualization-thread.md)
- [2026-05-24 UI interaction thread](2026-05-24-ui-interaction-thread.md)
