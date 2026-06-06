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
  getWatchedWalletNodeIds,
  isTransferEdge,
  isZeroAddressNodeId,
  uniqueSorted,
} from "./helpers";

type SharedFlowDirection = "funding" | "withdrawal";

interface SharedFlowConfig {
  analyzerId: string;
  name: string;
  direction: SharedFlowDirection;
  title: string;
  description: string;
  counterpartyMetadataKey: string;
  scoreImpact: number;
}

const fundingConfig: SharedFlowConfig = {
  analyzerId: "shared-funding-source",
  name: "Shared Funding Source Analyzer",
  direction: "funding",
  title: "Shared funding source found",
  description: "Two or more watched wallets received transfers from the same observed wallet. Review the source and transfer evidence before drawing ownership conclusions.",
  counterpartyMetadataKey: "sourceNodeId",
  scoreImpact: 30,
};

const withdrawalConfig: SharedFlowConfig = {
  analyzerId: "shared-withdrawal-destination",
  name: "Shared Withdrawal Destination Analyzer",
  direction: "withdrawal",
  title: "Shared withdrawal destination found",
  description: "Two or more watched wallets sent transfers to the same observed wallet. Treat this as a destination relationship signal for review.",
  counterpartyMetadataKey: "destinationNodeId",
  scoreImpact: 26,
};

export class SharedFundingSourceAnalyzer implements Analyzer {
  id = fundingConfig.analyzerId;
  name = fundingConfig.name;

  async run(context: AnalysisContext): Promise<Finding[]> {
    return runSharedFlowAnalyzer(context, fundingConfig);
  }
}

export class SharedWithdrawalDestinationAnalyzer implements Analyzer {
  id = withdrawalConfig.analyzerId;
  name = withdrawalConfig.name;

  async run(context: AnalysisContext): Promise<Finding[]> {
    return runSharedFlowAnalyzer(context, withdrawalConfig);
  }
}

function runSharedFlowAnalyzer(
  context: AnalysisContext,
  config: SharedFlowConfig,
): Finding[] {
  const nodeById = buildNodeIndex(context.graph.nodes);
  const watchedWalletNodeIds = getWatchedWalletNodeIds(context.graph.nodes);
  const edgesByCounterparty = new Map<string, GraphEdge[]>();

  for (const edge of context.graph.edges) {
    if (!isTransferEdge(edge)) {
      continue;
    }

    const counterpartyNodeId = getDirectionalCounterpartyNodeId({
      edge,
      source: nodeById.get(edge.source),
      target: nodeById.get(edge.target),
      watchedWalletNodeIds,
      direction: config.direction,
    });

    if (!counterpartyNodeId) {
      continue;
    }

    const edges = edgesByCounterparty.get(counterpartyNodeId) ?? [];
    edges.push(edge);
    edgesByCounterparty.set(counterpartyNodeId, edges);
  }

  const findings: Finding[] = [];

  for (const [counterpartyNodeId, edges] of edgesByCounterparty.entries()) {
    const watchedWalletNodeIdsForCounterparty = getWatchedWalletNodeIdsForFlow(
      edges,
      watchedWalletNodeIds,
      config.direction,
    );

    if (watchedWalletNodeIdsForCounterparty.length < 2) {
      continue;
    }

    const evidence = buildEvidence(context, edges);
    const metadata: Record<string, unknown> = {
      [config.counterpartyMetadataKey]: counterpartyNodeId,
      watchedWalletNodeIds: watchedWalletNodeIdsForCounterparty,
      edgeIds: edges.map((edge) => edge.id),
      direction: config.direction,
    };

    findings.push({
      id: `${config.analyzerId}:${counterpartyNodeId}`,
      analyzerId: config.analyzerId,
      title: config.title,
      description: config.description,
      severity: "medium",
      confidence: assessSharedFlowConfidence(watchedWalletNodeIdsForCounterparty.length, evidence.length),
      scoreImpact: assessSharedFlowScore(config.scoreImpact, watchedWalletNodeIdsForCounterparty.length, evidence.length),
      evidence,
      metadata,
    });
  }

  return findings.sort((left, right) => left.id.localeCompare(right.id));
}

function getDirectionalCounterpartyNodeId(input: {
  edge: GraphEdge;
  source?: GraphNode;
  target?: GraphNode;
  watchedWalletNodeIds: Set<string>;
  direction: SharedFlowDirection;
}): string | undefined {
  const { edge, source, target, watchedWalletNodeIds, direction } = input;

  if (direction === "funding") {
    if (
      watchedWalletNodeIds.has(edge.target) &&
      source?.kind === "wallet" &&
      source.tags?.includes("observed") &&
      !isZeroAddressNodeId(edge.source)
    ) {
      return edge.source;
    }

    return undefined;
  }

  if (
    watchedWalletNodeIds.has(edge.source) &&
    target?.kind === "wallet" &&
    target.tags?.includes("observed") &&
    !isZeroAddressNodeId(edge.target)
  ) {
    return edge.target;
  }

  return undefined;
}

function getWatchedWalletNodeIdsForFlow(
  edges: GraphEdge[],
  watchedWalletNodeIds: Set<string>,
  direction: SharedFlowDirection,
): string[] {
  const nodeIds = direction === "funding"
    ? edges.map((edge) => edge.target)
    : edges.map((edge) => edge.source);

  return uniqueSorted(nodeIds.filter((nodeId) => watchedWalletNodeIds.has(nodeId)));
}

function assessSharedFlowConfidence(
  watchedWalletCount: number,
  evidenceCount: number,
): FindingConfidence {
  if (watchedWalletCount >= 3 && evidenceCount >= 6) {
    return "high";
  }

  return "medium";
}

function assessSharedFlowScore(
  baseScore: number,
  watchedWalletCount: number,
  evidenceCount: number,
): number {
  const walletBonus = watchedWalletCount >= 3 ? 4 : 0;
  const evidenceBonus = evidenceCount >= 6 ? 4 : 0;

  return Math.min(36, baseScore + walletBonus + evidenceBonus);
}
