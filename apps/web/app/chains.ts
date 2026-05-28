import type { ChainId } from "@wallet-map/core";

export interface SupportedAnalysisChain {
  chainId: ChainId;
  key: "ethereum" | "arbitrum" | "base" | "optimism" | "polygon" | "bsc" | "solana";
  name: string;
  shortName: string;
  nativeSymbol: string;
  nativeDecimals: number;
  explorerBaseUrl: string;
  explorerName: string;
  ecosystem: "evm" | "solana";
  layer: "l1" | "l2" | "sidechain";
}

export const supportedAnalysisChains: SupportedAnalysisChain[] = [
  {
    chainId: 1,
    key: "ethereum",
    name: "Ethereum",
    shortName: "ETH",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    explorerBaseUrl: "https://etherscan.io",
    explorerName: "Etherscan",
    ecosystem: "evm",
    layer: "l1",
  },
  {
    chainId: 42161,
    key: "arbitrum",
    name: "Arbitrum",
    shortName: "ARB",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    explorerBaseUrl: "https://arbiscan.io",
    explorerName: "Arbiscan",
    ecosystem: "evm",
    layer: "l2",
  },
  {
    chainId: 8453,
    key: "base",
    name: "Base",
    shortName: "BASE",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    explorerBaseUrl: "https://basescan.org",
    explorerName: "BaseScan",
    ecosystem: "evm",
    layer: "l2",
  },
  {
    chainId: 10,
    key: "optimism",
    name: "Optimism",
    shortName: "OP",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    explorerBaseUrl: "https://optimistic.etherscan.io",
    explorerName: "Optimistic Etherscan",
    ecosystem: "evm",
    layer: "l2",
  },
  {
    chainId: 137,
    key: "polygon",
    name: "Polygon",
    shortName: "POLY",
    nativeSymbol: "POL",
    nativeDecimals: 18,
    explorerBaseUrl: "https://polygonscan.com",
    explorerName: "PolygonScan",
    ecosystem: "evm",
    layer: "sidechain",
  },
  {
    chainId: 56,
    key: "bsc",
    name: "BSC",
    shortName: "BSC",
    nativeSymbol: "BNB",
    nativeDecimals: 18,
    explorerBaseUrl: "https://bscscan.com",
    explorerName: "BscScan",
    ecosystem: "evm",
    layer: "l1",
  },
  {
    chainId: 101,
    key: "solana",
    name: "Solana",
    shortName: "SOL",
    nativeSymbol: "SOL",
    nativeDecimals: 9,
    explorerBaseUrl: "https://solscan.io",
    explorerName: "Solscan",
    ecosystem: "solana",
    layer: "l1",
  },
];

export const evmAggregateChainId = 0 as ChainId;

export function getEvmAggregateChains(): SupportedAnalysisChain[] {
  return supportedAnalysisChains.filter((chain) => chain.ecosystem === "evm");
}

export function getSupportedAnalysisChain(chainId: ChainId): SupportedAnalysisChain | undefined {
  return supportedAnalysisChains.find((chain) => chain.chainId === chainId);
}

export function buildExplorerTxUrl(chainId: ChainId, txHash: string): string | undefined {
  const chain = getSupportedAnalysisChain(chainId);

  if (!chain) {
    return undefined;
  }

  if (chain.ecosystem === "solana") {
    return `${chain.explorerBaseUrl}/tx/${txHash}`;
  }

  return `${chain.explorerBaseUrl}/tx/${txHash}`;
}

export function buildExplorerAddressUrl(chainId: ChainId, address: string): string | undefined {
  const chain = getSupportedAnalysisChain(chainId);

  if (!chain) {
    return undefined;
  }

  if (chain.ecosystem === "solana") {
    return `${chain.explorerBaseUrl}/account/${address}`;
  }

  return `${chain.explorerBaseUrl}/address/${address}`;
}

export function buildExplorerTokenUrl(chainId: ChainId, contract: string): string | undefined {
  const chain = getSupportedAnalysisChain(chainId);

  if (!chain) {
    return undefined;
  }

  if (chain.ecosystem === "solana") {
    return `${chain.explorerBaseUrl}/token/${contract}`;
  }

  return `${chain.explorerBaseUrl}/token/${contract}`;
}
