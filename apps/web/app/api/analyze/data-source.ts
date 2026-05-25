import { EtherscanLikeAdapter } from "@wallet-map/adapters";
import type { Address, ChainId, NormalizedEvent } from "@wallet-map/core";
import { getSupportedAnalysisChain } from "../../chains";
import fixtureEvents from "../../../../../fixtures/sample-events.json";
import type { AnalyzeDataMode } from "./schema";

export interface ResolveEventsInput {
  addresses: Address[];
  chainId: ChainId;
  dataMode: AnalyzeDataMode;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}

export interface ResolveEventsResult {
  events: NormalizedEvent[];
  mode: "fixture" | "live";
  source: string;
  chainName: string;
  fallbackReason?: string;
}

const etherscanV2BaseUrl = "https://api.etherscan.io/v2/api";
const etherscanApiKeyEnv = "ETHERSCAN_API_KEY";

export async function resolveAnalyzeEvents(
  input: ResolveEventsInput,
): Promise<ResolveEventsResult> {
  const env = input.env ?? process.env;
  const config = getSupportedAnalysisChain(input.chainId);
  const apiKey = env[etherscanApiKeyEnv]?.trim();

  if (input.dataMode === "fixture" || (input.dataMode === "auto" && !apiKey)) {
    const fallbackReason =
      input.dataMode === "auto" && !apiKey
        ? `${etherscanApiKeyEnv} is not configured, so Auto mode used fixture data instead.`
        : undefined;

    return {
      events: getFixtureEvents(input.chainId),
      mode: "fixture",
      source: "fixtures/sample-events.json",
      chainName: config?.name ?? `Chain ${input.chainId}`,
      fallbackReason,
    };
  }

  if (!config) {
    throw new Error(`Live mode is not configured for chain ID ${input.chainId}.`);
  }

  if (!apiKey && input.dataMode === "live") {
    throw new Error(`${etherscanApiKeyEnv} is required for live ${config.name} analysis.`);
  }

  const adapter = new EtherscanLikeAdapter({
    baseUrl: etherscanV2BaseUrl,
    apiKey,
    chainId: config.chainId,
    name: config.name,
    useChainIdParam: true,
    requestThrottleMs: 350,
    maxRateLimitRetries: 3,
    fetchImpl: input.fetchImpl,
  });
  const eventsByAddress: NormalizedEvent[][] = [];

  for (const address of input.addresses) {
    eventsByAddress.push(await adapter.getEvents({ address }));
  }

  return {
    events: dedupeEvents(eventsByAddress.flat()),
    mode: "live",
    source: adapter.id,
    chainName: config.name,
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
