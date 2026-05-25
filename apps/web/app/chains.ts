import type { ChainId } from "@wallet-map/core";

export interface SupportedAnalysisChain {
  chainId: ChainId;
  key: "ethereum" | "arbitrum" | "base" | "bsc";
  name: string;
  shortName: string;
  nativeSymbol: string;
  nativeDecimals: number;
  explorerBaseUrl: string;
  explorerName: string;
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
  },
];

export function getSupportedAnalysisChain(chainId: ChainId): SupportedAnalysisChain | undefined {
  return supportedAnalysisChains.find((chain) => chain.chainId === chainId);
}

export function buildExplorerTxUrl(chainId: ChainId, txHash: string): string | undefined {
  const chain = getSupportedAnalysisChain(chainId);

  if (!chain) {
    return undefined;
  }

  return `${chain.explorerBaseUrl}/tx/${txHash}`;
}

export function buildExplorerAddressUrl(chainId: ChainId, address: string): string | undefined {
  const chain = getSupportedAnalysisChain(chainId);

  if (!chain) {
    return undefined;
  }

  return `${chain.explorerBaseUrl}/address/${address}`;
}

export function buildExplorerTokenUrl(chainId: ChainId, contract: string): string | undefined {
  const chain = getSupportedAnalysisChain(chainId);

  if (!chain) {
    return undefined;
  }

  return `${chain.explorerBaseUrl}/token/${contract}`;
}
