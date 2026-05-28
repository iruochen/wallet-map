export type ChainId = number;
export type Address = string;
export type TxHash = string;

export interface ChainRef {
  chainId: ChainId;
  name?: string;
}

export interface BlockRange {
  fromBlock?: number;
  toBlock?: number;
}

export interface AddressIdentity {
  address: Address;
  chainId?: ChainId;
  label?: string;
  tags?: string[];
}

export type AssetKind = "native" | "erc20" | "erc721" | "erc1155" | "unknown";

export interface AssetRef {
  kind: AssetKind;
  chainId: ChainId;
  symbol?: string;
  contract?: Address;
  tokenId?: string;
}

export type NormalizedEventType =
  | "native_transfer"
  | "token_transfer"
  | "nft_transfer"
  | "contract_call"
  | "bridge"
  | "dex_swap";

export interface NormalizedEvent {
  id: string;
  type: NormalizedEventType;
  chainId: ChainId;
  txHash: TxHash;
  blockNumber: number;
  timestamp: string;
  from?: Address;
  to?: Address;
  contract?: Address;
  methodId?: string;
  asset?: AssetRef;
  amount?: string;
  metadata?: Record<string, unknown>;
}

export interface AnalysisSubject {
  id: string;
  addresses: AddressIdentity[];
}
