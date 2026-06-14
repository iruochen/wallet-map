export interface GraphExplorerNode {
  id: string;
  kind: "wallet" | "contract" | "entity" | "asset";
  address?: string;
  chainId?: number;
  label?: string;
  shortLabel?: string;
  tags?: string[];
}

export interface GraphExplorerEdge {
  id: string;
  kind:
    | "native_transfer"
    | "token_transfer"
    | "nft_transfer"
    | "contract_interaction"
    | "shared_counterparty"
    | "temporal_similarity"
    | "bridge_route";
  source: string;
  target: string;
  weight?: number;
  evidenceEventIds: string[];
  metadata?: {
    chainId?: number;
    txHash?: string;
    transactions?: Array<{
      txHash: string;
      timestamp: string;
      type: string;
    }>;
    amount?: string;
    methodId?: string;
    txCount?: number;
    asset?: {
      kind?: string;
      symbol?: string;
      contract?: string;
      decimals?: number;
      tokenId?: string;
    };
  };
}

export interface ResolvedNode extends GraphExplorerNode {
  role: "watched" | "observed" | "contract" | "entity";
  degree: number;
  shortLabel: string;
}
