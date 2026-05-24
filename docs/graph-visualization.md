# Graph Visualization Plan

## Goal

Wallet Map needs a graph explorer that helps users inspect relationships between watched wallets, observed counterparties, contracts, and evidence. The graph must start simple enough for the MVP, but avoid choices that trap the project when datasets grow.

This document focuses on frontend graph visualization. It does not replace the backend `RelationshipGraph` model or analyzer contracts.

## Tool Options

### React Flow

React Flow is a React-first canvas for node-based editors and diagrams.

Strengths:

- Excellent React integration and component ergonomics.
- Fast to build custom node cards, edge labels, side panels, context menus, and controlled state.
- Good fit for MVP interactions: select node, expand neighborhood, filter edge types, highlight paths.
- Familiar mental model for app UI engineers.
- Works well when the visible graph is intentionally bounded.

Tradeoffs:

- Not designed for very large dense graphs.
- Layout is usually delegated to Dagre, ELK, d3-force, or custom layout code.
- Performance can degrade if thousands of DOM-backed nodes are rendered at once.
- More of a diagram editor library than a graph analytics renderer.

Best fit:

- MVP and curated subgraphs.
- User-driven exploration where we show 20 to 300 nodes at a time.
- Rich node UI and evidence-linked interactions.

### Cytoscape.js

Cytoscape.js is a graph theory and visualization library with strong graph interactions and algorithms.

Strengths:

- Mature graph model with useful selectors, styling, layouts, and graph algorithms.
- Handles larger graphs than DOM-heavy React diagram approaches.
- Rich layout ecosystem, including force-directed and hierarchical layouts.
- Good at graph-native interactions: neighborhood selection, shortest path, centrality-like workflows, compound nodes.
- React wrapper exists, while the core remains framework independent.

Tradeoffs:

- React integration is less idiomatic than React Flow.
- Custom React node rendering is not the default path.
- Styling and interaction logic follow Cytoscape's API, which has a learning curve.
- Can become a second state model next to React if boundaries are not kept clean.

Best fit:

- Medium graphs where graph algorithms and exploration matter more than highly custom node UI.
- 300 to several thousand nodes, depending on edge density and styling.
- A future "analysis lab" mode with path finding and clustering.

### Sigma.js / Graphology

Sigma.js renders graphs with WebGL, and Graphology provides the graph data structure and algorithms.

Strengths:

- Best candidate here for large graph rendering.
- WebGL rendering is appropriate for thousands to tens of thousands of nodes.
- Graphology gives a clean graph model, metrics, traversal helpers, and layout integration.
- Good fit for performance-first graph exploration.

Tradeoffs:

- More engineering work for application-level interactions.
- Custom node UI is generally handled outside the canvas through overlays and side panels.
- React integration exists, but the app must own more glue code.
- Layout, incremental loading, clustering, and detail panels need deliberate design.

Best fit:

- Large graph mode.
- 5,000+ nodes or dense relationship exploration.
- Performance-focused rendering where nodes are visual marks, not React components.

## Recommendation

Use a phased approach instead of picking one library for all future graph sizes.

### MVP: React Flow

Use React Flow for the first user-facing graph explorer.

Why:

- The MVP needs interaction clarity more than raw graph scale.
- It lets us ship selected wallet nodes, observed counterparties, direct transfer edges, contract interaction edges, and finding-linked highlighting quickly.
- It fits the current Next.js + React + TypeScript stack.
- We can keep the visible graph bounded by default and avoid rendering the full raw event graph.

Expected scope:

- 2 to 20 watched wallets.
- 20 to 300 visible nodes.
- 50 to 800 visible edges after filtering and aggregation.
- Client-side layout using Dagre or ELK for stable first pass.
- User can expand local neighborhoods instead of loading every observed address at once.

### 1000 Node Level: Cytoscape.js

Introduce Cytoscape.js when users need medium-sized graph exploration.

Trigger signals:

- React Flow visible graph gets slow above several hundred nodes.
- We need built-in graph traversal, neighborhood queries, shortest path, or clustering.
- The graph view becomes more analytical than UI-component-heavy.

Approach:

- Keep the same frontend graph data contract.
- Add a renderer abstraction so the app can choose `react-flow` or `cytoscape`.
- Use Cytoscape for "dense exploration mode" while React Flow can remain the polished default for small graphs.

Expected scope:

- 500 to 3,000 nodes.
- Thousands of edges, with filtering and aggregation.
- Layouts run on demand, not on every small UI state update.

### 10k+ Node Level: Sigma.js / Graphology

Use Sigma.js and Graphology for large graph mode.

Trigger signals:

- Users want to inspect thousands of counterparties or multi-hop neighborhoods.
- Rendering performance matters more than custom node components.
- We need server-side pagination, clustering, and progressive graph loading.

Approach:

- Store and query graph slices from the backend.
- Pre-aggregate low-value edges and collapse high-degree entities.
- Render nodes as visual marks with side-panel details.
- Use Graphology as the frontend graph structure, with Sigma for rendering.

Expected scope:

- 5,000 to 50,000 nodes depending on edge density.
- Server-assisted expansion and clustering.
- Web Worker layout or precomputed layout for heavy views.

## Frontend Graph Data Contract

The UI should not render `RelationshipGraph` directly. It should consume a view model that is stable, display-oriented, and can be generated from `RelationshipGraph` plus findings and normalized events.

```ts
export interface GraphViewModel {
  schemaVersion: "1.0";
  generatedAt: string;
  summary: GraphViewSummary;
  nodes: GraphViewNode[];
  edges: GraphViewEdge[];
  groups?: GraphViewGroup[];
}

export interface GraphViewSummary {
  nodeCount: number;
  edgeCount: number;
  visibleNodeCount: number;
  visibleEdgeCount: number;
  truncated: boolean;
  truncationReason?: string;
}

export interface GraphViewNode {
  id: string;
  kind: "wallet" | "contract" | "entity" | "asset";
  role: "watched" | "observed" | "known_entity" | "system";
  address?: `0x${string}`;
  chainId?: number;
  label: string;
  tags: string[];
  metrics: {
    degree: number;
    incomingCount: number;
    outgoingCount: number;
    findingCount: number;
    totalTransferCount?: number;
  };
  visual: {
    size: number;
    colorToken: string;
    icon?: string;
  };
  collapsed?: boolean;
  expandable?: boolean;
}

export interface GraphViewEdge {
  id: string;
  kind:
    | "native_transfer"
    | "token_transfer"
    | "nft_transfer"
    | "contract_interaction"
    | "shared_counterparty"
    | "temporal_similarity"
    | "bridge_route";
  source: string;
  target: string;
  direction: "directed" | "undirected";
  weight: number;
  label: string;
  evidenceEventIds: string[];
  findingIds: string[];
  metrics: {
    eventCount: number;
    firstSeenAt?: string;
    lastSeenAt?: string;
    totalAmount?: string;
  };
  visual: {
    width: number;
    colorToken: string;
    dashed?: boolean;
  };
}

export interface GraphViewGroup {
  id: string;
  label: string;
  nodeIds: string[];
  kind: "chain" | "entity_cluster" | "expanded_counterparty" | "manual";
}
```

Mapping from current core model:

- `RelationshipGraph.nodes[].id` maps to `GraphViewNode.id`.
- `GraphNode.kind`, `address`, `chainId`, and `tags` map directly.
- `tags` containing `watched` maps to `role: "watched"`.
- `tags` containing `observed` maps to `role: "observed"`.
- `RelationshipGraph.edges[].id`, `kind`, `source`, `target`, `weight`, and `evidenceEventIds` map directly.
- `GraphEdge.metadata` can fill labels, timestamps, amount summaries, and chain-specific display.
- Findings should add `findingIds` to related edges and increment `findingCount` on related nodes.

Important contract rule:

- The backend or API layer should decide truncation, aggregation, and default visibility. The renderer should not be responsible for silently dropping data.

## Interaction Requirements

### MVP Interactions

- Click a node to open a detail panel with address, chain, tags, metrics, and connected findings.
- Click an edge to show evidence events and transaction hashes.
- Filter edge types: transfer, token transfer, NFT transfer, contract interaction, shared counterparty, bridge route.
- Highlight all edges and nodes related to a finding.
- Highlight direct path between two watched wallets when an analyzer provides one.
- Expand a watched wallet to show top observed counterparties.
- Collapse expanded counterparties back into a summary node.
- Preserve graph viewport when filters change where possible.
- Show loading, empty, and truncated states explicitly.

### Next Interactions

- Search by address, label, tx hash, or tag.
- Pin important nodes so layout changes do not move them.
- Toggle chain visibility.
- Show edge aggregation controls: raw transactions vs grouped relationships.
- Link evidence table row hover to graph edge highlight.
- Link graph selection to evidence table filtering.
- Export current graph slice as JSON.

### Later Interactions

- On-demand multi-hop expansion.
- Shortest path between selected wallets.
- Cluster high-degree counterparties.
- Hide known public entities such as routers, bridges, and CEX hot wallets.
- Compare two graph snapshots from different time ranges.
- Save a named graph view for a report.

## Data Volume Strategy

Use graph slices rather than rendering the whole graph by default.

MVP defaults:

- Always show watched wallets.
- Show direct edges between watched wallets.
- Show finding-related observed nodes.
- Show top counterparties by evidence count, capped by a configurable limit.
- Hide isolated nodes unless the user searches for them.

Medium graph defaults:

- Aggregate repeated transactions into one relationship edge.
- Collapse known public entities into grouped nodes.
- Load one-hop neighborhoods on demand.
- Run expensive layout only after data changes, not after panel or hover state changes.

Large graph defaults:

- Server-side graph slice API.
- Progressive loading with explicit node and edge caps.
- Precomputed metrics and clusters.
- Web Worker layout or backend layout for expensive algorithms.
- WebGL renderer for large exploration mode.

## Implementation Route

### Phase 1: Graph View Contract

- Add a graph view-model builder in the API or a small UI-facing package.
- Include graph summary, node metrics, edge labels, finding links, and truncation metadata.
- Keep renderer choice isolated behind the contract.

### Phase 2: React Flow MVP

- Add a `GraphExplorer` component.
- Render watched wallets, observed counterparties, contracts, and relationship edges.
- Add selection, filter controls, loading state, and evidence table linking.
- Keep default visible graph under a configurable cap.

### Phase 3: Medium Graph Mode

- Add Cytoscape.js behind the same view model if React Flow becomes limiting.
- Add neighborhood expansion and path highlighting.
- Add layout controls only when users need them.

### Phase 4: Large Graph Mode

- Add Sigma.js / Graphology for high-volume graph exploration.
- Add server-side graph slice endpoints.
- Add clustering and progressive expansion.

## Out of Scope For Early Versions

- Full graph database dependency solely for visualization.
- Rendering every raw transaction as a separate visible edge by default.
- 3D graph rendering.
- Real-time streaming graph updates.
- Collaborative graph editing.
- Manual drag-and-drop graph authoring as a primary workflow.
- Complex visual themes before interaction and evidence workflows are solid.
- Automatic claims like "same owner" from graph proximity alone.

## Open Decisions

- Whether the graph view-model builder should live in `packages/core`, `packages/exporters`, or a new UI-facing package.
- Whether graph layout should be generated server-side for saved reports.
- Whether known entities should be a first-class package or stored as labels in the storage layer.
- Whether graph slices should be persisted with analysis jobs or generated dynamically from stored edges and findings.
