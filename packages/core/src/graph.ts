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
