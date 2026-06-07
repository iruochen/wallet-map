import type { AnalysisRunResult, NormalizedEvent } from "@wallet-map/core";
import {
  buildPresentationGraph,
  buildPresentationSummary,
} from "./presentation";
import { buildGraphViewModel } from "./graph-view";
import type { ParsedAnalyzeRequest } from "./schema";
import type { ResolveEventsResult } from "./data-source";

const graphNodePreviewLimit = 200;
const graphEdgePreviewLimit = 240;
const findingEvidencePreviewLimit = 20;

export function buildAnalyzeResponse(
  parsed: ParsedAnalyzeRequest,
  resolved: ResolveEventsResult,
  result: AnalysisRunResult,
) {
  const eventsById = new Map(resolved.events.map((event) => [event.id, event]));
  const presentationGraph = buildPresentationGraph(result.graph, result.findings);
  const presentationSummary = buildPresentationSummary(result.findings, result.graph);
  const graphNodes = presentationGraph.graph.nodes.slice(0, graphNodePreviewLimit);
  const graphEdges = presentationGraph.graph.edges.slice(0, graphEdgePreviewLimit).map((edge) => ({
    ...edge,
    metadata: enrichEdgeMetadata(edge.metadata, edge.evidenceEventIds, eventsById),
  }));
  const nodesTruncated = presentationGraph.graph.nodes.length > graphNodePreviewLimit;
  const edgesTruncated = presentationGraph.graph.edges.length > graphEdgePreviewLimit;
  const fetchedAt = new Date().toISOString();

  return {
    mode: resolved.mode,
    source: resolved.source,
    sourceLabel: buildSourceLabel(resolved.mode, resolved.chainName, resolved.source),
    input: parsed,
    meta: {
      chainId: parsed.chainId,
      chainIds: parsed.chainIds,
      chainName: resolved.chainName,
      requestedMode: parsed.dataMode,
      resolvedMode: resolved.mode,
      dataProvider: parsed.dataProvider,
      watchedAddressCount: parsed.addresses.length,
      eventCount: resolved.events.length,
      graphNodeCount: presentationGraph.graph.nodes.length,
      graphEdgeCount: presentationGraph.graph.edges.length,
      graphWalletCount: presentationGraph.graph.nodes.filter((node) => node.kind === "wallet").length,
      graphContractCount: presentationGraph.graph.nodes.filter((node) => node.kind === "contract").length,
      fallbackReason: resolved.fallbackReason,
      warnings: resolved.warnings ?? [],
      fetchedAt,
    },
    summary: presentationSummary,
    graphView: buildGraphViewModel({
      defaultChainId: parsed.chainId,
      totalNodes: presentationGraph.graph.nodes.length,
      totalEdges: presentationGraph.graph.edges.length,
      nodesTruncated,
      edgesTruncated,
      nodes: graphNodes,
      edges: graphEdges,
      findings: result.findings,
      generatedAt: fetchedAt,
    }),
    graph: {
      totalNodes: presentationGraph.graph.nodes.length,
      totalEdges: presentationGraph.graph.edges.length,
      nodesTruncated,
      edgesTruncated,
      nodes: graphNodes,
      edges: graphEdges,
    },
    findings: result.findings.map((finding) => ({
      ...finding,
      evidenceTotal: finding.evidence.length,
      evidenceTruncated: finding.evidence.length > findingEvidencePreviewLimit,
      evidence: finding.evidence.slice(0, findingEvidencePreviewLimit).map((evidence) => {
        const event = eventsById.get(evidence.eventId);

        return {
          ...evidence,
          event: event ? toEvidenceEvent(event) : undefined,
        };
      }),
    })),
    score: result.score,
  };
}

function buildSourceLabel(mode: "fixture" | "live", chainName: string, source: string): string {
  if (mode === "live") {
    if (source.includes(",")) {
      return `Mixed live · ${chainName}`;
    }

    if (source.includes("solscan:")) {
      return `Solscan live · ${chainName}`;
    }

    if (source.includes("nodereal:")) {
      return `NodeReal live · ${chainName}`;
    }

    return `Etherscan V2 live · ${chainName}`;
  }

  return `Local fixture · ${chainName}`;
}

interface EvidenceEvent {
  type: NormalizedEvent["type"];
  chainId: NormalizedEvent["chainId"];
  txHash: string;
  blockNumber: number;
  timestamp: string;
  from?: string;
  to?: string;
  contract?: string;
  methodId?: string;
  amount?: string;
  asset?: {
    kind: string;
    symbol?: string;
    contract?: string;
    decimals?: number;
    tokenId?: string;
  };
  transferScope?: string;
}

interface GraphTransactionPreview {
  txHash: string;
  timestamp: string;
  type: NormalizedEvent["type"];
}

function enrichEdgeMetadata(
  metadata: Record<string, unknown> | undefined,
  evidenceEventIds: string[],
  eventsById: Map<string, NormalizedEvent>,
): Record<string, unknown> | undefined {
  if (!metadata) {
    return metadata;
  }

  const sampleEvent = evidenceEventIds
    .map((id) => eventsById.get(id))
    .find((candidate): candidate is NormalizedEvent => Boolean(candidate));
  const tokenDecimalsRaw = (sampleEvent?.metadata as { tokenDecimal?: string } | undefined)?.tokenDecimal;
  const tokenDecimals = tokenDecimalsRaw !== undefined ? Number(tokenDecimalsRaw) : undefined;
  const existingAsset = metadata.asset as
    | { kind?: string; symbol?: string; contract?: string; decimals?: number; tokenId?: string }
    | undefined;
  const transactions = buildGraphTransactionPreviews(evidenceEventIds, eventsById);

  if (!existingAsset) {
    return {
      ...metadata,
      transactions,
    };
  }

  const decimals =
    existingAsset.decimals !== undefined
      ? existingAsset.decimals
      : Number.isFinite(tokenDecimals)
        ? tokenDecimals
        : undefined;
  return {
    ...metadata,
    transactions,
    asset: {
      ...existingAsset,
      decimals,
    },
  };
}

function buildGraphTransactionPreviews(
  evidenceEventIds: string[],
  eventsById: Map<string, NormalizedEvent>,
): GraphTransactionPreview[] {
  const seen = new Set<string>();
  const transactions: GraphTransactionPreview[] = [];

  for (const eventId of evidenceEventIds) {
    const event = eventsById.get(eventId);
    if (!event || seen.has(event.txHash)) {
      continue;
    }

    seen.add(event.txHash);
    transactions.push({
      txHash: event.txHash,
      timestamp: event.timestamp,
      type: event.type,
    });
  }

  return transactions;
}

function toEvidenceEvent(event: NormalizedEvent): EvidenceEvent {
  const tokenDecimalsRaw = (event.metadata as { tokenDecimal?: string } | undefined)?.tokenDecimal;
  const tokenDecimals = tokenDecimalsRaw !== undefined ? Number(tokenDecimalsRaw) : undefined;
  const transferScope = (event.metadata as { transferScope?: string } | undefined)?.transferScope;

  return {
    type: event.type,
    chainId: event.chainId,
    txHash: event.txHash,
    blockNumber: event.blockNumber,
    timestamp: event.timestamp,
    from: event.from,
    to: event.to,
    contract: event.contract,
    methodId: event.methodId,
    amount: event.amount,
    asset: event.asset
      ? {
          kind: event.asset.kind,
          symbol: event.asset.symbol,
          contract: event.asset.contract,
          decimals: Number.isFinite(tokenDecimals) ? tokenDecimals : undefined,
          tokenId: event.asset.tokenId,
        }
      : undefined,
    transferScope,
  };
}
