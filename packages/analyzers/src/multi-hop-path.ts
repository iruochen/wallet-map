import type {
  AnalysisContext,
  Analyzer,
  Finding,
  FindingConfidence,
  GraphEdge,
  GraphNode,
} from "@wallet-map/core";
import {
  buildEvidence,
  buildNodeIndex,
  clampScore,
  dedupeEdges,
  getEdgeAssetKey,
  getWatchedWalletNodeIds,
  isTransferEdge,
  isZeroAddressNodeId,
  uniqueSorted,
} from "./helpers";

const multiHopMaxPathLength = 4;
const multiHopMaxPathsPerPair = 3;
const highDegreeIntermediateThreshold = 8;

interface PathCandidate {
  source: string;
  target: string;
  nodeIds: string[];
  edges: GraphEdge[];
}

export class MultiHopPathAnalyzer implements Analyzer {
  id = "multi-hop-path";
  name = "Multi-hop Path Analyzer";

  async run(context: AnalysisContext): Promise<Finding[]> {
    const nodeById = buildNodeIndex(context.graph.nodes);
    const watchedWalletNodeIds = getWatchedWalletNodeIds(context.graph.nodes);
    const transferEdges = context.graph.edges.filter(isTransferEdge);
    const adjacency = buildTransferAdjacency(transferEdges);
    const walletDegree = buildWalletDegree(transferEdges);
    const pathsByPair = new Map<string, PathCandidate[]>();

    for (const source of Array.from(watchedWalletNodeIds).sort()) {
      const paths = findTransferPaths({
        source,
        adjacency,
        nodeById,
        watchedWalletNodeIds,
        walletDegree,
      });

      for (const path of paths) {
        const pairKey = `${path.source}|${path.target}`;
        const current = pathsByPair.get(pairKey) ?? [];
        current.push(path);
        current.sort(comparePathCandidates);
        pathsByPair.set(pairKey, current.slice(0, multiHopMaxPathsPerPair));
      }
    }

    return Array.from(pathsByPair.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([_pairKey, paths]) => this.buildFinding(context, paths));
  }

  private buildFinding(context: AnalysisContext, paths: PathCandidate[]): Finding {
    const primaryPath = paths[0]!;
    const allEdges = dedupeEdges(paths.flatMap((path) => path.edges));
    const edgeIds = allEdges.map((edge) => edge.id);
    const pathLengths = paths.map((path) => path.edges.length);
    const shortestPathLength = Math.min(...pathLengths);
    const watchedWalletNodeIds = uniqueSorted([primaryPath.source, primaryPath.target]);
    const intermediateNodeIds = uniqueSorted(paths.flatMap((path) => path.nodeIds.slice(1, -1)));
    const scoreImpact = assessMultiHopScore(paths);

    return {
      id: `${this.id}:${primaryPath.source}:${primaryPath.target}`,
      analyzerId: this.id,
      title: "Multi-hop transfer path found",
      description: "Watched wallets are connected by a short transfer path through observed wallets. Treat this as a relationship signal for review, not proof of common ownership.",
      severity: "medium",
      confidence: assessMultiHopConfidence(paths),
      scoreImpact,
      evidence: buildEvidence(context, allEdges),
      metadata: {
        source: primaryPath.source,
        target: primaryPath.target,
        watchedWalletNodeIds,
        edgeIds,
        pathEdgeIds: paths.map((path) => path.edges.map((edge) => edge.id)),
        pathNodeIds: paths.map((path) => path.nodeIds),
        pathLength: shortestPathLength,
        pathLengths,
        intermediateNodeIds,
      },
    };
  }
}

function assessMultiHopConfidence(paths: PathCandidate[]): FindingConfidence {
  const shortestPathLength = Math.min(...paths.map((path) => path.edges.length));

  if (shortestPathLength === 2 && paths.length >= 2) {
    return "high";
  }

  if (shortestPathLength <= 3) {
    return "medium";
  }

  return "low";
}

function assessMultiHopScore(paths: PathCandidate[]): number {
  const shortestPathLength = Math.min(...paths.map((path) => path.edges.length));
  const base = shortestPathLength === 2 ? 35 : shortestPathLength === 3 ? 28 : 22;
  const pathBonus = Math.min(10, Math.max(0, paths.length - 1) * 5);
  const sharedAssetBonus = paths.some(pathHasRepeatedAsset) ? 5 : 0;

  return clampScore(base + pathBonus + sharedAssetBonus, 20, 45);
}

function pathHasRepeatedAsset(path: PathCandidate): boolean {
  const assetKeys = path.edges
    .map((edge) => getEdgeAssetKey(edge))
    .filter((assetKey): assetKey is string => Boolean(assetKey));

  return assetKeys.length >= 2 && new Set(assetKeys).size === 1;
}

function buildTransferAdjacency(edges: GraphEdge[]): Map<string, GraphEdge[]> {
  const adjacency = new Map<string, GraphEdge[]>();

  for (const edge of edges) {
    const current = adjacency.get(edge.source) ?? [];
    current.push(edge);
    adjacency.set(edge.source, current);
  }

  for (const current of adjacency.values()) {
    current.sort((left, right) => left.id.localeCompare(right.id));
  }

  return adjacency;
}

function buildWalletDegree(edges: GraphEdge[]): Map<string, number> {
  const degree = new Map<string, number>();

  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }

  return degree;
}

function findTransferPaths(input: {
  source: string;
  adjacency: Map<string, GraphEdge[]>;
  nodeById: Map<string, GraphNode>;
  watchedWalletNodeIds: Set<string>;
  walletDegree: Map<string, number>;
}): PathCandidate[] {
  const paths: PathCandidate[] = [];

  function visit(currentNodeId: string, nodeIds: string[], edges: GraphEdge[]): void {
    if (edges.length >= multiHopMaxPathLength) {
      return;
    }

    for (const edge of input.adjacency.get(currentNodeId) ?? []) {
      const nextNodeId = edge.target;
      if (nodeIds.includes(nextNodeId)) {
        continue;
      }

      const nextNode = input.nodeById.get(nextNodeId);
      if (!nextNode || nextNode.kind !== "wallet" || isZeroAddressNodeId(nextNodeId)) {
        continue;
      }

      const nextEdges = [...edges, edge];
      const nextNodeIds = [...nodeIds, nextNodeId];
      const nextIsWatched = input.watchedWalletNodeIds.has(nextNodeId);

      if (nextIsWatched) {
        if (nextNodeId !== input.source && nextEdges.length >= 2) {
          paths.push({
            source: input.source,
            target: nextNodeId,
            nodeIds: nextNodeIds,
            edges: nextEdges,
          });
        }
        continue;
      }

      if (!nextNode.tags?.includes("observed")) {
        continue;
      }

      if ((input.walletDegree.get(nextNodeId) ?? 0) > highDegreeIntermediateThreshold) {
        continue;
      }

      visit(nextNodeId, nextNodeIds, nextEdges);
    }
  }

  visit(input.source, [input.source], []);

  return paths.sort(comparePathCandidates);
}

function comparePathCandidates(left: PathCandidate, right: PathCandidate): number {
  if (left.edges.length !== right.edges.length) {
    return left.edges.length - right.edges.length;
  }

  return left.edges
    .map((edge) => edge.id)
    .join("|")
    .localeCompare(right.edges.map((edge) => edge.id).join("|"));
}
