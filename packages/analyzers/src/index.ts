import type {
  AnalysisContext,
  Analyzer,
  Finding,
  FindingConfidence,
  GraphEdge,
  GraphNode,
} from "@wallet-map/core";
import { BridgeCorrelationAnalyzer } from "./bridge-correlation";
import {
  buildEvidence,
  buildNodeIndex,
  getWatchedWalletNodeIds,
  isPublicEntityNode,
  isTransferEdge,
  isZeroAddressNodeId,
} from "./helpers";
import { MultiHopPathAnalyzer } from "./multi-hop-path";
import { SharedFundingSourceAnalyzer, SharedWithdrawalDestinationAnalyzer } from "./shared-flow";
import { TemporalPatternAnalyzer } from "./temporal-pattern";

export { BridgeCorrelationAnalyzer } from "./bridge-correlation";
export { MultiHopPathAnalyzer } from "./multi-hop-path";
export { SharedFundingSourceAnalyzer, SharedWithdrawalDestinationAnalyzer } from "./shared-flow";
export { TemporalPatternAnalyzer } from "./temporal-pattern";

export class DirectTransferAnalyzer implements Analyzer {
  id = "direct-transfer";
  name = "Direct Transfer Analyzer";

  async run(context: AnalysisContext): Promise<Finding[]> {
    const walletNodeIds = getWatchedWalletNodeIds(context.graph.nodes);
    const directEdges = context.graph.edges.filter((edge) => {
      return walletNodeIds.has(edge.source) && walletNodeIds.has(edge.target) && isTransferEdge(edge);
    });

    return directEdges.map((edge) => ({
      id: `${this.id}:${edge.id}`,
      analyzerId: this.id,
      title: "Direct transfer found",
      description: "Two watched wallets have a direct transfer relationship.",
      severity: "high",
      confidence: assessDirectTransferConfidence(edge.evidenceEventIds.length),
      scoreImpact: 40,
      evidence: buildEvidence(context, [edge]),
      metadata: {
        edgeId: edge.id,
        source: edge.source,
        target: edge.target,
      },
    }));
  }
}

export class SharedCounterpartyAnalyzer implements Analyzer {
  id = "shared-counterparty";
  name = "Shared Counterparty Analyzer";

  async run(context: AnalysisContext): Promise<Finding[]> {
    const nodeById = buildNodeIndex(context.graph.nodes);
    const watchedWalletNodeIds = getWatchedWalletNodeIds(context.graph.nodes);
    const edgesByCounterparty = new Map<string, GraphEdge[]>();

    for (const edge of context.graph.edges) {
      if (!isTransferEdge(edge)) {
        continue;
      }

      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      const counterpartyNodeId = getObservedWalletCounterpartyNodeId({
        edge,
        source,
        target,
        watchedWalletNodeIds,
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
      const watchedWalletNodeIdsForCounterparty = getWatchedWalletNodeIdsForEdges(
        edges,
        watchedWalletNodeIds,
      );

      if (watchedWalletNodeIdsForCounterparty.length < 2) {
        continue;
      }

      const evidence = buildEvidence(context, edges);
      const counterpartyNode = nodeById.get(counterpartyNodeId);
      const publicEntity = isPublicEntityNode(counterpartyNode);

      findings.push({
        id: `${this.id}:${counterpartyNodeId}`,
        analyzerId: this.id,
        title: "Shared counterparty found",
        description: "Two or more watched wallets have transfer activity with the same observed wallet.",
        severity: publicEntity ? "low" : "medium",
        confidence: assessSharedCounterpartyConfidence(
          watchedWalletNodeIdsForCounterparty.length,
          evidence.length,
          publicEntity,
        ),
        scoreImpact: publicEntity ? 8 : 24,
        evidence,
        metadata: {
          counterpartyNodeId,
          watchedWalletNodeIds: watchedWalletNodeIdsForCounterparty,
          edgeIds: edges.map((edge) => edge.id),
          publicEntity,
        },
      });
    }

    return findings;
  }
}

export class SameContractInteractionAnalyzer implements Analyzer {
  id = "same-contract-interaction";
  name = "Same Contract Interaction Analyzer";

  async run(context: AnalysisContext): Promise<Finding[]> {
    const nodeById = buildNodeIndex(context.graph.nodes);
    const watchedWalletNodeIds = getWatchedWalletNodeIds(context.graph.nodes);
    const interactionEdgesByContract = new Map<string, GraphEdge[]>();

    for (const edge of context.graph.edges) {
      if (edge.kind !== "contract_interaction" || !watchedWalletNodeIds.has(edge.source)) {
        continue;
      }

      const edges = interactionEdgesByContract.get(edge.target) ?? [];
      edges.push(edge);
      interactionEdgesByContract.set(edge.target, edges);
    }

    const findings: Finding[] = [];

    for (const [contractNodeId, edges] of interactionEdgesByContract.entries()) {
      const watchedWalletNodeIdsForContract = Array.from(
        new Set(edges.map((edge) => edge.source).filter((nodeId) => watchedWalletNodeIds.has(nodeId))),
      ).sort();

      if (watchedWalletNodeIdsForContract.length < 2) {
        continue;
      }

      const evidence = buildEvidence(context, edges);
      const contractNode = nodeById.get(contractNodeId);
      const publicEntity = isPublicEntityNode(contractNode);

      findings.push({
        id: `${this.id}:${contractNodeId}`,
        analyzerId: this.id,
        title: "Same contract interaction found",
        description: "Two or more watched wallets interacted with the same contract.",
        severity: "low",
        confidence: assessSameContractConfidence(watchedWalletNodeIdsForContract.length, evidence.length, publicEntity),
        scoreImpact: publicEntity ? 6 : 16,
        evidence,
        metadata: {
          contractNodeId,
          watchedWalletNodeIds: watchedWalletNodeIdsForContract,
          edgeIds: edges.map((edge) => edge.id),
          publicEntity,
        },
      });
    }

    return findings;
  }
}

export function createDefaultAnalyzers(): Analyzer[] {
  return [
    new DirectTransferAnalyzer(),
    new SharedCounterpartyAnalyzer(),
    new SameContractInteractionAnalyzer(),
    new SharedFundingSourceAnalyzer(),
    new SharedWithdrawalDestinationAnalyzer(),
    new MultiHopPathAnalyzer(),
    new TemporalPatternAnalyzer(),
    new BridgeCorrelationAnalyzer(),
  ];
}

function getObservedWalletCounterpartyNodeId(input: {
  edge: GraphEdge;
  source?: GraphNode;
  target?: GraphNode;
  watchedWalletNodeIds: Set<string>;
}): string | undefined {
  const { edge, source, target, watchedWalletNodeIds } = input;
  const sourceIsWatched = watchedWalletNodeIds.has(edge.source);
  const targetIsWatched = watchedWalletNodeIds.has(edge.target);

  if (sourceIsWatched && target?.kind === "wallet" && target.tags?.includes("observed")) {
    return isZeroAddressNodeId(edge.target) ? undefined : edge.target;
  }

  if (targetIsWatched && source?.kind === "wallet" && source.tags?.includes("observed")) {
    return isZeroAddressNodeId(edge.source) ? undefined : edge.source;
  }

  return undefined;
}

function assessDirectTransferConfidence(evidenceCount: number): FindingConfidence {
  return evidenceCount > 0 ? "high" : "medium";
}

function assessSharedCounterpartyConfidence(
  watchedWalletCount: number,
  evidenceCount: number,
  publicEntity: boolean,
): FindingConfidence {
  if (publicEntity) {
    return "low";
  }

  if (watchedWalletCount >= 3 && evidenceCount >= 6) {
    return "high";
  }

  return "medium";
}

function assessSameContractConfidence(
  watchedWalletCount: number,
  evidenceCount: number,
  publicEntity: boolean,
): FindingConfidence {
  if (publicEntity) {
    return "low";
  }

  if (watchedWalletCount >= 3 || evidenceCount >= 6) {
    return "medium";
  }

  return "low";
}

function getWatchedWalletNodeIdsForEdges(
  edges: GraphEdge[],
  watchedWalletNodeIds: Set<string>,
): string[] {
  const nodeIds = new Set<string>();

  for (const edge of edges) {
    if (watchedWalletNodeIds.has(edge.source)) {
      nodeIds.add(edge.source);
    }

    if (watchedWalletNodeIds.has(edge.target)) {
      nodeIds.add(edge.target);
    }
  }

  return Array.from(nodeIds).sort();
}
