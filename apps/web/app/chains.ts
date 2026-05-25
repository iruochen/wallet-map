import type { ChainId } from "@wallet-map/core";

export interface SupportedAnalysisChain {
  chainId: ChainId;
  key: "ethereum" | "arbitrum" | "base" | "bsc";
  name: string;
  shortName: string;
}

export const supportedAnalysisChains: SupportedAnalysisChain[] = [
  {
    chainId: 1,
    key: "ethereum",
    name: "Ethereum",
    shortName: "ETH",
  },
  {
    chainId: 42161,
    key: "arbitrum",
    name: "Arbitrum",
    shortName: "ARB",
  },
  {
    chainId: 8453,
    key: "base",
    name: "Base",
    shortName: "BASE",
  },
  {
    chainId: 56,
    key: "bsc",
    name: "BSC",
    shortName: "BSC",
  },
];

export function getSupportedAnalysisChain(chainId: ChainId): SupportedAnalysisChain | undefined {
  return supportedAnalysisChains.find((chain) => chain.chainId === chainId);
}
