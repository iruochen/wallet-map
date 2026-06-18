import type { GraphExplorerEdge, ResolvedNode } from "./graph-types";

export interface DenseGraphSubset {
  nodes: ResolvedNode[];
  edges: GraphExplorerEdge[];
  hiddenNodeCount: number;
  hiddenEdgeCount: number;
}

const alwaysKeepDegreeThreshold = 8;
const alwaysKeepIncidentEvidenceThreshold = 24;

// Reduce visual noise in large graphs by keeping the multi-signal backbone
// and only a tiny sample of one-hop leaves for local context.
export function buildDenseGraphSubset(
  nodes: ResolvedNode[],
  edges: GraphExplorerEdge[],
): DenseGraphSubset {
  if (nodes.length === 0 || edges.length === 0) {
    return { nodes, edges, hiddenNodeCount: 0, hiddenEdgeCount: 0 };
  }

  const leafBuckets = new Map<string, Array<{ nodeId: string; score: number }>>();
  const connectedWatchedMap = buildConnectedWatchedMap(nodes, edges);
  const incidentEvidenceCount = buildIncidentEvidenceCount(edges);
  const keptNodeIds = new Set<string>();

  for (const node of nodes) {
    const connectedWatchedIds = connectedWatchedMap.get(node.id) ?? [];
    const primaryWatchedId = connectedWatchedIds[0] ?? "shared";
    const bucketKey = `${primaryWatchedId}:${node.role}:${resolveConnectionScope(connectedWatchedIds)}`;
    const incidentScore = incidentEvidenceCount.get(node.id) ?? 0;

    if (node.role === "watched") {
      keptNodeIds.add(node.id);
      continue;
    }

    if (
      node.degree >= alwaysKeepDegreeThreshold ||
      incidentScore >= alwaysKeepIncidentEvidenceThreshold
    ) {
      keptNodeIds.add(node.id);
      continue;
    }

    const bucket = leafBuckets.get(bucketKey) ?? [];
    bucket.push({
      nodeId: node.id,
      score: incidentScore * 10 + connectedWatchedIds.length * 6 + node.degree,
    });
    leafBuckets.set(bucketKey, bucket);
  }

  for (const [bucketKey, candidates] of leafBuckets.entries()) {
    const limit = resolveBucketLimit(bucketKey);
    candidates
      .sort((left, right) => right.score - left.score || left.nodeId.localeCompare(right.nodeId))
      .slice(0, limit)
      .forEach((candidate) => {
        keptNodeIds.add(candidate.nodeId);
      });
  }

  const nextEdges = edges.filter((edge) => keptNodeIds.has(edge.source) && keptNodeIds.has(edge.target));
  if (nextEdges.length === 0 || nextEdges.length >= edges.length) {
    return { nodes, edges, hiddenNodeCount: 0, hiddenEdgeCount: 0 };
  }

  const finalizedNodeIds = new Set<string>();
  nextEdges.forEach((edge) => {
    finalizedNodeIds.add(edge.source);
    finalizedNodeIds.add(edge.target);
  });
  nodes.forEach((node) => {
    if (node.role === "watched" && keptNodeIds.has(node.id)) {
      finalizedNodeIds.add(node.id);
    }
  });

  const nextNodes = nodes.filter((node) => finalizedNodeIds.has(node.id));

  return {
    nodes: nextNodes,
    edges: nextEdges,
    hiddenNodeCount: Math.max(0, nodes.length - nextNodes.length),
    hiddenEdgeCount: Math.max(0, edges.length - nextEdges.length),
  };
}

function buildIncidentEvidenceCount(edges: GraphExplorerEdge[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const edge of edges) {
    const edgeEvidence = Math.max(edge.metadata?.txCount ?? 0, edge.evidenceEventIds.length, 1);
    counts.set(edge.source, (counts.get(edge.source) ?? 0) + edgeEvidence);
    counts.set(edge.target, (counts.get(edge.target) ?? 0) + edgeEvidence);
  }

  return counts;
}

function resolveConnectionScope(connectedWatchedIds: string[]): "shared" | "single" | "mixed" {
  if (connectedWatchedIds.length === 0) {
    return "shared";
  }

  if (connectedWatchedIds.length === 1) {
    return "single";
  }

  return "mixed";
}

function resolveBucketLimit(bucketKey: string): number {
  if (bucketKey.includes(":contract:shared") || bucketKey.includes(":contract:mixed")) {
    return 6;
  }

  if (bucketKey.includes(":observed:shared") || bucketKey.includes(":observed:mixed")) {
    return 10;
  }

  if (bucketKey.includes(":entity:shared") || bucketKey.includes(":entity:mixed")) {
    return 6;
  }

  if (bucketKey.includes(":contract:single")) {
    return 4;
  }

  if (bucketKey.includes(":entity:single")) {
    return 4;
  }

  return 6;
}

function buildConnectedWatchedMap(
  nodes: ResolvedNode[],
  edges: GraphExplorerEdge[],
): Map<string, string[]> {
  const watchedNodeIds = new Set(nodes.filter((node) => node.role === "watched").map((node) => node.id));
  const connectedMap = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (watchedNodeIds.has(edge.source) && !watchedNodeIds.has(edge.target)) {
      const current = connectedMap.get(edge.target) ?? new Set<string>();
      current.add(edge.source);
      connectedMap.set(edge.target, current);
    }

    if (watchedNodeIds.has(edge.target) && !watchedNodeIds.has(edge.source)) {
      const current = connectedMap.get(edge.source) ?? new Set<string>();
      current.add(edge.target);
      connectedMap.set(edge.source, current);
    }
  }

  return new Map(
    Array.from(connectedMap.entries()).map(([nodeId, watchedIds]) => [
      nodeId,
      Array.from(watchedIds).sort(),
    ]),
  );
}
