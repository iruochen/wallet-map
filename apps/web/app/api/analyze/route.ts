import { createDefaultAnalyzers } from "@wallet-map/analyzers";
import type { NormalizedEvent } from "@wallet-map/core";
import { runAnalysis } from "@wallet-map/core";
import {
  buildPresentationGraph,
  buildPresentationSummary,
} from "./presentation";
import { resolveAnalyzeEvents } from "./data-source";
import { parseAnalyzeRequest } from "./schema";

const graphNodePreviewLimit = 200;
const graphEdgePreviewLimit = 240;
const findingEvidencePreviewLimit = 20;

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as unknown;
    const parsed = parseAnalyzeRequest(
      typeof body === "object" && body !== null ? body : {},
    );
    const resolved = await resolveAnalyzeEvents(parsed);
    const result = await runAnalysis({
      watchedAddresses: parsed.addresses,
      events: resolved.events,
      analyzers: createDefaultAnalyzers(),
    });
    const eventsById = new Map(resolved.events.map((event) => [event.id, event]));
    const presentationGraph = buildPresentationGraph(result.graph, result.findings);
    const presentationSummary = buildPresentationSummary(result.findings, result.graph);

    return Response.json({
      mode: resolved.mode,
      source: resolved.source,
      sourceLabel: buildSourceLabel(resolved.mode, resolved.chainName),
      input: parsed,
      meta: {
        chainId: parsed.chainId,
        chainName: resolved.chainName,
        requestedMode: parsed.dataMode,
        resolvedMode: resolved.mode,
        watchedAddressCount: parsed.addresses.length,
        eventCount: resolved.events.length,
        graphNodeCount: presentationGraph.graph.nodes.length,
        graphEdgeCount: presentationGraph.graph.edges.length,
        graphWalletCount: presentationGraph.graph.nodes.filter((node) => node.kind === "wallet").length,
        graphContractCount: presentationGraph.graph.nodes.filter((node) => node.kind === "contract").length,
        fallbackReason: resolved.fallbackReason,
        fetchedAt: new Date().toISOString(),
      },
      summary: presentationSummary,
      graph: {
        totalNodes: presentationGraph.graph.nodes.length,
        totalEdges: presentationGraph.graph.edges.length,
        nodesTruncated: presentationGraph.graph.nodes.length > graphNodePreviewLimit,
        edgesTruncated: presentationGraph.graph.edges.length > graphEdgePreviewLimit,
        nodes: presentationGraph.graph.nodes.slice(0, graphNodePreviewLimit),
        edges: presentationGraph.graph.edges.slice(0, graphEdgePreviewLimit).map((edge) => ({
          ...edge,
          metadata: enrichEdgeMetadata(edge.metadata, edge.evidenceEventIds, eventsById),
        })),
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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected analysis error.";

    return Response.json({ error: message }, { status: 400 });
  }
}

function buildSourceLabel(mode: "fixture" | "live", chainName: string): string {
  if (mode === "live") {
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
