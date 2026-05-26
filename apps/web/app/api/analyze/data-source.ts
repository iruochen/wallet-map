import { EtherscanLikeAdapter, NodeRealBscAdapter } from "@wallet-map/adapters";
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
const nodeRealBscApiKeyEnv = "NODEREAL_BSC_API_KEY";

export async function resolveAnalyzeEvents(
  input: ResolveEventsInput,
): Promise<ResolveEventsResult> {
  const env = input.env ?? process.env;
  const config = getSupportedAnalysisChain(input.chainId);
  const etherscanApiKey = env[etherscanApiKeyEnv]?.trim();
  const nodeRealBscApiKey = env[nodeRealBscApiKeyEnv]?.trim();
  const liveProvider = resolveLiveProvider(input.chainId, {
    etherscanApiKey,
    nodeRealBscApiKey,
  });

  if (input.dataMode === "fixture" || (input.dataMode === "auto" && !liveProvider)) {
    const fallbackReason =
      input.dataMode === "auto" && !liveProvider
        ? buildMissingLiveConfigMessage(input.chainId)
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

  if (!liveProvider && input.dataMode === "live") {
    throw new Error(buildMissingLiveRequirementMessage(config.name, input.chainId));
  }

  const adapter =
    liveProvider === "nodereal-bsc"
      ? new NodeRealBscAdapter({
          apiKey: nodeRealBscApiKey ?? "",
          requestThrottleMs: 200,
          maxRateLimitRetries: 3,
          fetchImpl: input.fetchImpl,
        })
      : new EtherscanLikeAdapter({
          baseUrl: etherscanV2BaseUrl,
          apiKey: etherscanApiKey,
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

function resolveLiveProvider(
  chainId: ChainId,
  input: {
    etherscanApiKey?: string;
    nodeRealBscApiKey?: string;
  },
): "etherscan-v2" | "nodereal-bsc" | null {
  if (chainId === 56 && input.nodeRealBscApiKey) {
    return "nodereal-bsc";
  }

  if (input.etherscanApiKey) {
    return "etherscan-v2";
  }

  return null;
}

function buildMissingLiveConfigMessage(chainId: ChainId): string {
  if (chainId === 56) {
    return `${nodeRealBscApiKeyEnv} or ${etherscanApiKeyEnv} is not configured, so Auto mode used fixture data instead.`;
  }

  return `${etherscanApiKeyEnv} is not configured, so Auto mode used fixture data instead.`;
}

function buildMissingLiveRequirementMessage(chainName: string, chainId: ChainId): string {
  if (chainId === 56) {
    return `${nodeRealBscApiKeyEnv} or ${etherscanApiKeyEnv} is required for live ${chainName} analysis.`;
  }

  return `${etherscanApiKeyEnv} is required for live ${chainName} analysis.`;
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
