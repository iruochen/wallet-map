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
        fetchedAt: new Date().toISOString(),
      },
      summary: presentationSummary,
      graph: {
        totalNodes: presentationGraph.graph.nodes.length,
        totalEdges: presentationGraph.graph.edges.length,
        nodesTruncated: presentationGraph.graph.nodes.length > graphNodePreviewLimit,
        edgesTruncated: presentationGraph.graph.edges.length > graphEdgePreviewLimit,
        nodes: enrichGraphNodeLabels(
          presentationGraph.graph.nodes,
          resolved.events,
        ).slice(0, graphNodePreviewLimit),
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

const knownTokenEntries: Array<[number, string, string]> = [
  [1, "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", "USDC"],
  [1, "0xdac17f958d2ee523a2206206994597c13d831ec7", "USDT"],
  [1, "0x6b175474e89094c44da98b954eedeac495271d0f", "DAI"],
  [1, "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", "WBTC"],
  [1, "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", "WETH"],
  [42161, "0xaf88d065e77c8cc2239327c5edb3a432268e5831", "USDC"],
  [42161, "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8", "USDC.e"],
  [42161, "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", "USDT"],
  [42161, "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", "WETH"],
  [10, "0x0b2c639c533813f4aa9d7837caf62653d097ff85", "USDC"],
  [10, "0x7f5c764cbc14f9669b88837ca1490cca17c31607", "USDC.e"],
  [10, "0x4200000000000000000000000000000000000006", "WETH"],
  [8453, "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", "USDC"],
  [8453, "0x4200000000000000000000000000000000000006", "WETH"],
  [137, "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", "USDC"],
  [137, "0x2791bca1f2de4661ed88a30c99a7a9449aa84174", "USDC.e"],
  [137, "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", "USDT"],
  [56, "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", "USDC"],
  [56, "0x55d398326f99059ff775485246999027b3197955", "USDT"],
  [56, "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", "WBNB"],
];

const knownTokenLabels = new Map<string, string>(
  knownTokenEntries.map(([chainId, address, label]) => [`${chainId}:${address}`, label]),
);

function enrichGraphNodeLabels(
  nodes: ReturnType<typeof buildPresentationGraph>["graph"]["nodes"],
  events: NormalizedEvent[],
): ReturnType<typeof buildPresentationGraph>["graph"]["nodes"] {
  const tokenLabels = buildTokenLabelIndex(events);

  return nodes.map((node) => {
    if (node.kind !== "contract" || !node.address || node.chainId === undefined) {
      return node;
    }

    const key = `${node.chainId}:${node.address.toLowerCase()}`;
    const label = tokenLabels.get(key) ?? knownTokenLabels.get(key);

    if (!label) {
      return node;
    }

    return {
      ...node,
      label,
      tags: Array.from(new Set([...(node.tags ?? []), "token"])),
    };
  });
}

function buildTokenLabelIndex(events: NormalizedEvent[]): Map<string, string> {
  const labels = new Map<string, string>();

  for (const event of events) {
    const contract = event.asset?.contract ?? event.contract;
    const symbol = event.asset?.symbol;

    if (!contract || !symbol) {
      continue;
    }

    labels.set(`${event.chainId}:${contract.toLowerCase()}`, symbol);
  }

  return labels;
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
