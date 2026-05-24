# 2026-05-24 Graph Visualization Thread

## Goal

Design the first graph visualization direction for Wallet Map without implementing large UI changes.

## Write Scope

- `docs/graph-visualization.md`
- `agents/**`

## Task

- Compare React Flow, Cytoscape.js, and Sigma.js / Graphology.
- Recommend a staged path for MVP, 1000-node scale, and 10k-node scale.
- Define a frontend graph data contract that can be derived from the current `RelationshipGraph`.
- List key graph interactions such as node click, edge filtering, counterparty expansion, evidence linking, and path highlighting.
- Mark early out-of-scope items to avoid premature complexity.

## Result

Completed as documentation only. The implementation recommendation is:

- Start with React Flow for the MVP graph explorer.
- Add Cytoscape.js when graph-native exploration and medium-sized graphs become important.
- Add Sigma.js / Graphology for large graph mode with server-side slicing and progressive expansion.

No Git commit was created by this thread.
