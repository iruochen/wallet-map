import { getSupportedAnalysisChain } from "../../app/chains";

const sourceLabels: Record<string, string> = {
  "local-labels": "本地标签",
  "static-label-registry": "静态标签",
  "chainbase-address-labels": "Chainbase",
  "etherscan-nametag": "Etherscan",
  "known-entity-labels": "已知实体",
};

const nodeKindLabels: Record<string, string> = {
  wallet: "钱包",
  contract: "合约",
  entity: "实体",
  asset: "资产",
};

const categoryLabels: Record<string, string> = {
  exchange: "交易所",
  bridge: "跨链桥",
  dex: "DEX",
  defi: "DeFi",
  stablecoin: "稳定币",
  token: "代币",
  contract: "合约",
  wallet: "钱包",
  unknown: "未知",
};

export function formatLabelChainName(chainId: number): string {
  const chain = getSupportedAnalysisChain(chainId);

  if (!chain) {
    return `未知链 (${chainId})`;
  }

  return `${chain.name} · ${chain.shortName}`;
}

export function formatLabelChainShort(chainId: number): string {
  const chain = getSupportedAnalysisChain(chainId);

  return chain?.shortName ?? String(chainId);
}

export function formatLabelSource(source: string): string {
  return sourceLabels[source] ?? source;
}

export function formatLabelNodeKind(nodeKind: string): string {
  return nodeKindLabels[nodeKind] ?? nodeKind;
}

export function formatLabelCategory(category: string | undefined): string | undefined {
  if (!category) {
    return undefined;
  }

  return categoryLabels[category] ?? category;
}

export function isLocalLabelSource(source: string): boolean {
  return source === "local-labels";
}
