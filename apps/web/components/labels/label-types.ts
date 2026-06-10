export interface KnownLabelRecord {
  id: string;
  nodeKind: "wallet" | "contract" | "entity" | "asset";
  chainId: number;
  address: string;
  label: string;
  entity?: string;
  category?: string;
  tags: string[];
  source: string;
  confidence?: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
}

export interface LabelListStats {
  total: number;
  local: number;
  discovered: number;
}

export interface LabelResponse {
  labels?: KnownLabelRecord[];
  total?: number;
  limit?: number;
  offset?: number;
  stats?: LabelListStats;
  storageEnabled?: boolean;
  error?: string;
}

export const defaultLabelPageSize = 20;
export const labelPageSizeOptions = [10, 20, 50] as const;

export type ListChainFilter = "all" | number;
export type SourceFilter = "all" | "local-labels" | "discovered";

export interface LabelFormState {
  address: string;
  label: string;
  entity: string;
  category: string;
  tags: string;
  nodeKind: string;
}

export const emptyLabelForm: LabelFormState = {
  address: "",
  label: "",
  entity: "",
  category: "",
  tags: "",
  nodeKind: "wallet",
};

export const labelCategoryOptions = [
  { value: "", label: "不设置" },
  { value: "exchange", label: "交易所" },
  { value: "bridge", label: "跨链桥" },
  { value: "dex", label: "DEX" },
  { value: "defi", label: "DeFi" },
  { value: "stablecoin", label: "稳定币" },
  { value: "token", label: "代币" },
  { value: "contract", label: "合约" },
  { value: "wallet", label: "钱包" },
  { value: "unknown", label: "未知" },
] as const;

export const labelNodeKindOptions = [
  { value: "wallet", label: "钱包" },
  { value: "contract", label: "合约" },
  { value: "entity", label: "实体" },
  { value: "asset", label: "资产" },
] as const;
