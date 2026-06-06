import { getWalletNodeId } from "@wallet-map/core";
import type {
  AnalysisContext,
  Finding,
  GraphEdge,
  GraphNode,
  NormalizedEvent,
} from "@wallet-map/core";

const transferEdgeKinds = ["native_transfer", "token_transfer", "nft_transfer"] as const;

export function buildNodeIndex(nodes: GraphNode[]): Map<string, GraphNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

export function getWatchedWalletNodeIds(nodes: GraphNode[]): Set<string> {
  return new Set(
    nodes
      .filter((node) => node.kind === "wallet" && node.tags?.includes("watched"))
      .map((node) => node.id),
  );
}

export function isTransferEdge(edge: GraphEdge): boolean {
  return transferEdgeKinds.includes(edge.kind as (typeof transferEdgeKinds)[number]);
}

export function isTransferEvent(event: NormalizedEvent): boolean {
  return event.type === "native_transfer" || event.type === "token_transfer" || event.type === "nft_transfer";
}

export function isZeroAddressNodeId(nodeId: string): boolean {
  return nodeId.endsWith(":0x0000000000000000000000000000000000000000");
}

export function buildEvidence(context: AnalysisContext, edges: GraphEdge[]): Finding["evidence"] {
  const eventById = new Map(context.events.map((event) => [event.id, event]));

  return uniqueSorted(edges.flatMap((edge) => edge.evidenceEventIds)).map((eventId) => {
    const event = eventById.get(eventId);

    return {
      eventId,
      txHash: event?.txHash,
      summary: event
        ? `${event.type} on chain ${event.chainId} in transaction ${event.txHash}`
        : `Evidence event ${eventId}`,
    };
  });
}

export function buildEventEvidence(events: NormalizedEvent[]): Finding["evidence"] {
  return dedupeEvents(events).map((event) => ({
    eventId: event.id,
    txHash: event.txHash,
    summary: `${event.type} on chain ${event.chainId} in transaction ${event.txHash}`,
  }));
}

export function getEdgesByEvidenceEventId(edges: GraphEdge[]): Map<string, GraphEdge[]> {
  const edgesByEventId = new Map<string, GraphEdge[]>();

  for (const edge of edges) {
    for (const eventId of edge.evidenceEventIds) {
      const current = edgesByEventId.get(eventId) ?? [];
      current.push(edge);
      edgesByEventId.set(eventId, current);
    }
  }

  return edgesByEventId;
}

export function getEventTimestampMs(event: NormalizedEvent): number | undefined {
  const timestampMs = new Date(event.timestamp).getTime();
  return Number.isFinite(timestampMs) ? timestampMs : undefined;
}

export function getAssetKey(event: NormalizedEvent): string {
  if (!event.asset) {
    return `${event.type}:${event.chainId}:unknown`;
  }

  const contract = event.asset.contract?.toLowerCase() ?? "native";
  const tokenId = event.asset.tokenId ? `:${event.asset.tokenId}` : "";
  return `${event.asset.kind}:${event.asset.chainId}:${contract}${tokenId}`;
}

export function getEdgeAssetKey(edge: GraphEdge): string | undefined {
  const asset = edge.metadata?.asset as { kind?: string; chainId?: number; contract?: string; tokenId?: string } | undefined;
  if (!asset?.kind || asset.chainId === undefined) {
    return undefined;
  }

  return `${asset.kind}:${asset.chainId}:${asset.contract?.toLowerCase() ?? "native"}${asset.tokenId ? `:${asset.tokenId}` : ""}`;
}

export function getWatchedActorNodeId(
  event: NormalizedEvent,
  watchedWalletNodeIds: Set<string>,
): string | undefined {
  if (event.from) {
    const fromNodeId = getWalletNodeId(event.chainId, event.from);
    if (watchedWalletNodeIds.has(fromNodeId)) {
      return fromNodeId;
    }
  }

  if (event.to) {
    const toNodeId = getWalletNodeId(event.chainId, event.to);
    if (watchedWalletNodeIds.has(toNodeId)) {
      return toNodeId;
    }
  }

  return undefined;
}

export function readMetadataString(
  metadata: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().toLowerCase();
    }
  }

  return undefined;
}

export function readMetadataNumber(
  metadata: Record<string, unknown> | undefined,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const value = metadata?.[key];
    const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (Number.isInteger(numberValue)) {
      return numberValue;
    }
  }

  return undefined;
}

export function hasSimilarAmounts(amounts: string[]): boolean {
  if (amounts.length < 2) {
    return false;
  }

  if (new Set(amounts).size === 1) {
    return true;
  }

  const numericAmounts = amounts.map((amount) => Number(amount));
  if (numericAmounts.some((amount) => !Number.isFinite(amount) || amount <= 0)) {
    return false;
  }

  const min = Math.min(...numericAmounts);
  const max = Math.max(...numericAmounts);
  return (max - min) / max <= 0.01;
}

export function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort();
}

export function dedupeEdges(edges: GraphEdge[]): GraphEdge[] {
  return Array.from(new Map(edges.map((edge) => [edge.id, edge])).values()).sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}

export function dedupeEvents(events: NormalizedEvent[]): NormalizedEvent[] {
  return Array.from(new Map(events.map((event) => [event.id, event])).values()).sort((left, right) => {
    const leftTimestamp = getEventTimestampMs(left) ?? 0;
    const rightTimestamp = getEventTimestampMs(right) ?? 0;

    if (leftTimestamp !== rightTimestamp) {
      return leftTimestamp - rightTimestamp;
    }

    return left.id.localeCompare(right.id);
  });
}

export function clampScore(score: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, score));
}

export function sanitizeFindingId(value: string): string {
  return value.replace(/[^a-zA-Z0-9:._-]/g, "_");
}

export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
