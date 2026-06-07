import type { ChainId, Finding, GraphEdge, GraphEdgeKind, GraphNode, GraphNodeKind } from "@wallet-map/core";

export interface GraphViewNode {
  id: string;
  kind: GraphNodeKind;
  role: "watched" | "observed" | "contract" | "entity";
  label: string;
  shortLabel: string;
  degree: number;
  address?: string;
  chainId?: ChainId;
  tags: string[];
  metrics: {
    degree: number;
    incomingCount: number;
    outgoingCount: number;
    findingCount: number;
  };
  visual: {
    size: number;
    colorToken: "wallet-watched" | "wallet-observed" | "contract" | "entity";
    icon: "wallet" | "contract" | "entity";
  };
}

export interface GraphViewEdge {
  id: string;
  kind: GraphEdgeKind;
  source: string;
  target: string;
  direction: "directed" | "undirected";
  weight: number;
  label: string;
  evidenceEventIds: string[];
  findingIds: string[];
  metrics: {
    eventCount: number;
  };
  metadata?: GraphEdge["metadata"];
}

export interface GraphViewWalletFilter {
  address: string;
  nodeIds: string[];
  label: string;
}

export interface GraphViewModel {
  schemaVersion: "1.0";
  generatedAt: string;
  summary: {
    nodeCount: number;
    edgeCount: number;
    visibleNodeCount: number;
    visibleEdgeCount: number;
    truncated: boolean;
  };
  totalNodes: number;
  totalEdges: number;
  nodesTruncated: boolean;
  edgesTruncated: boolean;
  defaultChainId: ChainId;
  availableChainIds: ChainId[];
  walletFilters: GraphViewWalletFilter[];
  nodes: GraphViewNode[];
  edges: GraphViewEdge[];
}

export function buildGraphViewModel(input: {
  defaultChainId: ChainId;
  totalNodes: number;
  totalEdges: number;
  nodesTruncated: boolean;
  edgesTruncated: boolean;
  nodes: GraphNode[];
  edges: GraphEdge[];
  findings?: Finding[];
  generatedAt?: string;
}): GraphViewModel {
  const metricsByNodeId = buildGraphViewNodeMetrics(input.nodes, input.edges, input.findings ?? []);
  const findingIdsByEdgeId = buildFindingIdsByEdgeId(input.findings ?? []);

  const nodes = input.nodes.map((node) => {
    const label = node.label ?? node.address ?? node.id;
    const role = resolveGraphViewNodeRole(node);
    const metrics = metricsByNodeId.get(node.id) ?? {
      degree: 0,
      incomingCount: 0,
      outgoingCount: 0,
      findingCount: 0,
    };

    return {
      id: node.id,
      kind: node.kind,
      role,
      label,
      shortLabel: shortenGraphViewLabel(label),
      degree: metrics.degree,
      address: node.address,
      chainId: node.chainId,
      tags: node.tags ?? [],
      metrics,
      visual: buildGraphViewNodeVisual(role),
    };
  });
  const edges = input.edges.map((edge) => ({
    id: edge.id,
    kind: edge.kind,
    source: edge.source,
    target: edge.target,
    direction: resolveGraphViewEdgeDirection(edge.kind),
    weight: edge.weight,
    label: buildGraphViewEdgeLabel(edge),
    evidenceEventIds: edge.evidenceEventIds,
    findingIds: findingIdsByEdgeId.get(edge.id) ?? [],
    metrics: {
      eventCount: edge.evidenceEventIds.length,
    },
    metadata: edge.metadata,
  }));
  const truncated = input.nodesTruncated || input.edgesTruncated;

  return {
    schemaVersion: "1.0",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    summary: {
      nodeCount: input.totalNodes,
      edgeCount: input.totalEdges,
      visibleNodeCount: nodes.length,
      visibleEdgeCount: edges.length,
      truncated,
    },
    totalNodes: input.totalNodes,
    totalEdges: input.totalEdges,
    nodesTruncated: input.nodesTruncated,
    edgesTruncated: input.edgesTruncated,
    defaultChainId: input.defaultChainId,
    availableChainIds: collectGraphViewChainIds(input.defaultChainId, nodes, edges),
    walletFilters: collectGraphViewWalletFilters(nodes),
    nodes,
    edges,
  };
}

function buildGraphViewNodeMetrics(
  nodes: GraphNode[],
  edges: GraphEdge[],
  findings: Finding[],
): Map<string, GraphViewNode["metrics"]> {
  const metrics = new Map(
    nodes.map((node) => [
      node.id,
      {
        degree: 0,
        incomingCount: 0,
        outgoingCount: 0,
        findingCount: 0,
      },
    ]),
  );

  for (const edge of edges) {
    const source = metrics.get(edge.source);
    const target = metrics.get(edge.target);

    if (source) {
      source.degree += 1;
      source.outgoingCount += 1;
    }

    if (target) {
      target.degree += 1;
      target.incomingCount += 1;
    }
  }

  for (const finding of findings) {
    const metadata = finding.metadata as
      | {
          source?: string;
          target?: string;
          watchedWalletNodeIds?: string[];
        }
      | undefined;
    const nodeIds = new Set([
      metadata?.source,
      metadata?.target,
      ...(metadata?.watchedWalletNodeIds ?? []),
    ].filter((nodeId): nodeId is string => Boolean(nodeId)));

    for (const nodeId of nodeIds) {
      const current = metrics.get(nodeId);
      if (current) {
        current.findingCount += 1;
      }
    }
  }

  return metrics;
}

function buildFindingIdsByEdgeId(findings: Finding[]): Map<string, string[]> {
  const findingIdsByEdgeId = new Map<string, string[]>();

  for (const finding of findings) {
    const metadata = finding.metadata as { edgeId?: string; edgeIds?: string[] } | undefined;
    const edgeIds = [metadata?.edgeId, ...(metadata?.edgeIds ?? [])].filter(
      (edgeId): edgeId is string => Boolean(edgeId),
    );

    for (const edgeId of edgeIds) {
      const findingIds = findingIdsByEdgeId.get(edgeId) ?? [];
      findingIds.push(finding.id);
      findingIdsByEdgeId.set(edgeId, findingIds);
    }
  }

  return findingIdsByEdgeId;
}

function resolveGraphViewNodeRole(node: GraphNode): GraphViewNode["role"] {
  if (node.kind === "contract") {
    return "contract";
  }

  if (node.kind === "wallet") {
    return node.tags?.includes("watched") ? "watched" : "observed";
  }

  return "entity";
}

function shortenGraphViewLabel(label: string): string {
  if (label.startsWith("0x") && label.length > 12) {
    return `${label.slice(0, 6)}...${label.slice(-4)}`;
  }

  return label;
}

function buildGraphViewNodeVisual(role: GraphViewNode["role"]): GraphViewNode["visual"] {
  if (role === "watched") {
    return { size: 48, colorToken: "wallet-watched", icon: "wallet" };
  }

  if (role === "observed") {
    return { size: 28, colorToken: "wallet-observed", icon: "wallet" };
  }

  if (role === "contract") {
    return { size: 26, colorToken: "contract", icon: "contract" };
  }

  return { size: 24, colorToken: "entity", icon: "entity" };
}

function resolveGraphViewEdgeDirection(kind: GraphEdgeKind): GraphViewEdge["direction"] {
  return kind === "shared_counterparty" || kind === "temporal_similarity" ? "undirected" : "directed";
}

function buildGraphViewEdgeLabel(edge: GraphEdge): string {
  const txCount = typeof edge.metadata?.txCount === "number" ? edge.metadata.txCount : edge.evidenceEventIds.length;

  if (txCount > 1) {
    return `${edge.kind} · ${txCount} tx`;
  }

  if (typeof edge.metadata?.methodId === "string") {
    return `${edge.kind} · ${edge.metadata.methodId}`;
  }

  return edge.kind;
}

function collectGraphViewChainIds(
  defaultChainId: ChainId,
  nodes: GraphViewNode[],
  edges: GraphViewEdge[],
): ChainId[] {
  const chainIds = new Set<ChainId>();

  for (const node of nodes) {
    if (node.chainId !== undefined && node.chainId > 0) {
      chainIds.add(node.chainId);
    }
  }

  for (const edge of edges) {
    const chainId = typeof edge.metadata?.chainId === "number" ? edge.metadata.chainId : undefined;
    if (chainId !== undefined && chainId > 0) {
      chainIds.add(chainId);
    }
  }

  if (chainIds.size === 0 && defaultChainId > 0) {
    chainIds.add(defaultChainId);
  }

  return Array.from(chainIds).sort((left, right) => left - right);
}

function collectGraphViewWalletFilters(nodes: GraphViewNode[]): GraphViewWalletFilter[] {
  const groups = new Map<string, string[]>();

  for (const node of nodes) {
    if (node.role !== "watched" || !node.address) {
      continue;
    }

    const address = node.address.toLowerCase();
    const nodeIds = groups.get(address) ?? [];
    nodeIds.push(node.id);
    groups.set(address, nodeIds);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([address, nodeIds]) => ({
      address,
      nodeIds,
      label: shortenGraphViewLabel(address),
    }));
}
