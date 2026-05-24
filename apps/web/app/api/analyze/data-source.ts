import { EtherscanLikeAdapter } from "@wallet-map/adapters";
import type { Address, ChainId, NormalizedEvent } from "@wallet-map/core";
import fixtureEvents from "../../../../../fixtures/sample-events.json";
import type { AnalyzeDataMode } from "./schema";

interface ChainScanConfig {
  chainId: ChainId;
  name: string;
  baseUrl: string;
  apiKeyEnv: string;
}

export interface ResolveEventsInput {
  addresses: Address[];
  chainId: ChainId;
  dataMode: AnalyzeDataMode;
  env?: Record<string, string | undefined>;
}

export interface ResolveEventsResult {
  events: NormalizedEvent[];
  mode: "fixture" | "live";
  source: string;
}

const chainScanConfigs: Record<number, ChainScanConfig> = {
  1: {
    chainId: 1,
    name: "Ethereum",
    baseUrl: "https://api.etherscan.io/api",
    apiKeyEnv: "ETHERSCAN_API_KEY",
  },
  42161: {
    chainId: 42161,
    name: "Arbitrum",
    baseUrl: "https://api.arbiscan.io/api",
    apiKeyEnv: "ARBISCAN_API_KEY",
  },
  8453: {
    chainId: 8453,
    name: "Base",
    baseUrl: "https://api.basescan.org/api",
    apiKeyEnv: "BASESCAN_API_KEY",
  },
  56: {
    chainId: 56,
    name: "BSC",
    baseUrl: "https://api.bscscan.com/api",
    apiKeyEnv: "BSCSCAN_API_KEY",
  },
};

export async function resolveAnalyzeEvents(
  input: ResolveEventsInput,
): Promise<ResolveEventsResult> {
  const env = input.env ?? process.env;
  const config = chainScanConfigs[input.chainId];
  const apiKey = config ? env[config.apiKeyEnv]?.trim() : undefined;

  if (input.dataMode === "fixture" || (input.dataMode === "auto" && !apiKey)) {
    return {
      events: getFixtureEvents(input.chainId),
      mode: "fixture",
      source: "fixtures/sample-events.json",
    };
  }

  if (!config) {
    throw new Error(`Live mode is not configured for chain ID ${input.chainId}.`);
  }

  if (!apiKey && input.dataMode === "live") {
    throw new Error(`${config.apiKeyEnv} is required for live ${config.name} analysis.`);
  }

  const adapter = new EtherscanLikeAdapter({
    baseUrl: config.baseUrl,
    apiKey,
    chainId: config.chainId,
    name: config.name,
  });
  const eventsByAddress = await Promise.all(
    input.addresses.map((address) => adapter.getEvents({ address })),
  );

  return {
    events: dedupeEvents(eventsByAddress.flat()),
    mode: "live",
    source: adapter.id,
  };
}

function getFixtureEvents(chainId: ChainId): NormalizedEvent[] {
  return (fixtureEvents as NormalizedEvent[]).filter((event) => event.chainId === chainId);
}

function dedupeEvents(events: NormalizedEvent[]): NormalizedEvent[] {
  return Array.from(new Map(events.map((event) => [event.id, event])).values()).sort((left, right) => {
    if (left.blockNumber !== right.blockNumber) {
      return left.blockNumber - right.blockNumber;
    }

    return left.id.localeCompare(right.id);
  });
}
