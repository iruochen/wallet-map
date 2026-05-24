import type { Address, ChainId, NormalizedEvent } from "./models";

export type GraphNodeKind = "wallet" | "contract" | "entity" | "asset";

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  address?: Address;
  chainId?: ChainId;
  label?: string;
  tags?: string[];
}

export type GraphEdgeKind =
  | "native_transfer"
  | "token_transfer"
  | "nft_transfer"
  | "contract_interaction"
  | "shared_counterparty"
  | "temporal_similarity"
  | "bridge_route";

export interface GraphEdge {
  id: string;
  kind: GraphEdgeKind;
  source: string;
  target: string;
  weight: number;
  evidenceEventIds: string[];
  metadata?: Record<string, unknown>;
}

export interface RelationshipGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphBuildInput {
  events: NormalizedEvent[];
  watchedAddresses: Address[];
}

const transferEdgeKinds = new Map<NormalizedEvent["type"], GraphEdgeKind>([
  ["native_transfer", "native_transfer"],
  ["token_transfer", "token_transfer"],
  ["nft_transfer", "nft_transfer"],
]);

export function getWalletNodeId(chainId: ChainId, address: Address): string {
  return `wallet:${chainId}:${address.toLowerCase()}`;
}

export function getContractNodeId(chainId: ChainId, address: Address): string {
  return `contract:${chainId}:${address.toLowerCase()}`;
}

export function buildRelationshipGraph(input: GraphBuildInput): RelationshipGraph {
  const watchedAddressKeys = new Set(input.watchedAddresses.map(normalizeAddress));
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  for (const event of input.events) {
    for (const address of input.watchedAddresses) {
      addWalletNode(nodes, event.chainId, address, watchedAddressKeys);
    }

    const transferEdgeKind = transferEdgeKinds.get(event.type);

    if (transferEdgeKind && event.from && event.to) {
      const source = addWalletNode(nodes, event.chainId, event.from, watchedAddressKeys);
      const target = addWalletNode(nodes, event.chainId, event.to, watchedAddressKeys);
      const edgeId = `${transferEdgeKind}:${event.chainId}:${event.txHash}:${event.from.toLowerCase()}:${event.to.toLowerCase()}`;

      upsertEdge(edges, {
        id: edgeId,
        kind: transferEdgeKind,
        source: source.id,
        target: target.id,
        weight: 1,
        evidenceEventIds: [event.id],
        metadata: {
          chainId: event.chainId,
          txHash: event.txHash,
          amount: event.amount,
          asset: event.asset,
        },
      });

      continue;
    }

    if (event.type === "contract_call" && event.from && event.contract) {
      const source = addWalletNode(nodes, event.chainId, event.from, watchedAddressKeys);
      const target = addContractNode(nodes, event.chainId, event.contract);
      const edgeId = `contract_interaction:${event.chainId}:${event.txHash}:${event.from.toLowerCase()}:${event.contract.toLowerCase()}`;

      upsertEdge(edges, {
        id: edgeId,
        kind: "contract_interaction",
        source: source.id,
        target: target.id,
        weight: 1,
        evidenceEventIds: [event.id],
        metadata: {
          chainId: event.chainId,
          txHash: event.txHash,
          methodId: event.methodId,
        },
      });
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
  };
}

function normalizeAddress(address: Address): string {
  return address.toLowerCase();
}

function addWalletNode(
  nodes: Map<string, GraphNode>,
  chainId: ChainId,
  address: Address,
  watchedAddressKeys: Set<string>,
): GraphNode {
  const id = getWalletNodeId(chainId, address);
  const existing = nodes.get(id);

  if (existing) {
    return existing;
  }

  const node: GraphNode = {
    id,
    kind: "wallet",
    address,
    chainId,
    tags: watchedAddressKeys.has(normalizeAddress(address)) ? ["watched"] : ["observed"],
  };

  nodes.set(id, node);
  return node;
}

function addContractNode(
  nodes: Map<string, GraphNode>,
  chainId: ChainId,
  address: Address,
): GraphNode {
  const id = getContractNodeId(chainId, address);
  const existing = nodes.get(id);

  if (existing) {
    return existing;
  }

  const node: GraphNode = {
    id,
    kind: "contract",
    address,
    chainId,
  };

  nodes.set(id, node);
  return node;
}

function upsertEdge(edges: Map<string, GraphEdge>, edge: GraphEdge): void {
  const existing = edges.get(edge.id);

  if (!existing) {
    edges.set(edge.id, edge);
    return;
  }

  for (const eventId of edge.evidenceEventIds) {
    if (!existing.evidenceEventIds.includes(eventId)) {
      existing.evidenceEventIds.push(eventId);
    }
  }

  existing.weight += edge.weight;
}
