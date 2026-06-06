import { EtherscanLikeAdapter, NodeRealEvmAdapter, SolscanAdapter } from "@wallet-map/adapters";
import type { ChainAdapter } from "@wallet-map/adapters";
import type { Address, ChainId, NormalizedEvent } from "@wallet-map/core";
import { getSupportedAnalysisChain } from "../../chains";
import fixtureEvents from "../../../../../fixtures/sample-events.json";
import type { AnalyzeDataMode, AnalyzeDataProvider } from "./schema";

export interface ResolveEventsInput {
  addresses: Address[];
  chainId: ChainId;
  chainIds?: ChainId[];
  dataMode: AnalyzeDataMode;
  dataProvider?: AnalyzeDataProvider;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}

export interface ResolveEventsResult {
  events: NormalizedEvent[];
  mode: "fixture" | "live";
  source: string;
  chainName: string;
  fallbackReason?: string;
  warnings?: string[];
}

type LiveProviderId = "etherscan-v2" | "nodereal" | "solscan";

export interface LiveProviderPlan {
  chainId: ChainId;
  provider: LiveProviderId | null;
  fallbackProvider?: LiveProviderId;
}

const etherscanV2BaseUrl = "https://api.etherscan.io/v2/api";
const etherscanApiKeyEnv = "ETHERSCAN_API_KEY";
const nodeRealApiKeyEnv = "NODEREAL_API_KEY";
const nodeRealBscApiKeyEnv = "NODEREAL_BSC_API_KEY";
const solscanApiKeyEnv = "SOLSCAN_API_KEY";
const liveAddressConcurrencyEnv = "ANALYZE_LIVE_ADDRESS_CONCURRENCY";
const defaultLiveAddressConcurrency = 2;
const maxLiveAddressConcurrency = 8;

const nodeRealEndpoints = new Map<ChainId, string>([
  [1, "https://eth-mainnet.nodereal.io/v1/{apiKey}"],
  [56, "https://bsc-mainnet.nodereal.io/v1/{apiKey}"],
]);

export async function resolveAnalyzeEvents(
  input: ResolveEventsInput,
): Promise<ResolveEventsResult> {
  const env = input.env ?? process.env;
  const requestedChainIds = input.chainIds?.length ? input.chainIds : [input.chainId];
  const etherscanApiKey = env[etherscanApiKeyEnv]?.trim();
  const nodeRealApiKey = env[nodeRealApiKeyEnv]?.trim() || env[nodeRealBscApiKeyEnv]?.trim();
  const nodeRealBscApiKey = env[nodeRealBscApiKeyEnv]?.trim();
  const solscanApiKey = env[solscanApiKeyEnv]?.trim();
  const dataProvider = input.dataProvider ?? "auto";
  const liveAddressConcurrency = parseLiveAddressConcurrency(env[liveAddressConcurrencyEnv]);
  const livePlans = requestedChainIds.map((chainId) =>
    selectAnalyzeLiveProvider(chainId, {
      dataProvider,
      etherscanApiKey,
      nodeRealApiKey,
      nodeRealBscApiKey,
      solscanApiKey,
    }),
  );
  const hasAnyLiveProvider = livePlans.some((plan) => plan.provider !== null);

  if (input.dataMode === "fixture" || (input.dataMode === "auto" && !hasAnyLiveProvider)) {
    const fallbackReason =
      input.dataMode === "auto" && !hasAnyLiveProvider
        ? buildMissingLiveConfigMessage(requestedChainIds, dataProvider)
        : undefined;

    return {
      events: dedupeEvents(requestedChainIds.flatMap((chainId) => getFixtureEvents(chainId))),
      mode: "fixture",
      source: "fixtures/sample-events.json",
      chainName: buildChainName(requestedChainIds),
      fallbackReason,
    };
  }

  const unsupportedChainId = requestedChainIds.find((chainId) => !getSupportedAnalysisChain(chainId));
  if (unsupportedChainId !== undefined) {
    throw new Error(`Live mode is not configured for chain ID ${unsupportedChainId}.`);
  }

  const eventsByAddress: NormalizedEvent[][] = [];
  const sources = new Set<string>();
  const warnings: string[] = [];
  const allowPartial = requestedChainIds.length > 1;

  for (const plan of livePlans) {
    const config = getSupportedAnalysisChain(plan.chainId);
    if (!config) {
      continue;
    }

    if (!plan.provider && input.dataMode === "live") {
      if (allowPartial) {
        warnings.push(buildMissingLiveRequirementMessage(config.name, plan.chainId, dataProvider));
        continue;
      }

      throw new Error(buildMissingLiveRequirementMessage(config.name, plan.chainId, dataProvider));
    }

    if (!plan.provider) {
      warnings.push(buildMissingLiveRequirementMessage(config.name, plan.chainId, dataProvider));
      continue;
    }

    const adapter = buildAdapter({
      plan,
      configName: config.name,
      etherscanApiKey,
      nodeRealApiKey,
      nodeRealBscApiKey,
      solscanApiKey,
      fetchImpl: input.fetchImpl,
    });

    const addressResults = await mapWithConcurrency(
      input.addresses.filter((address) => addressMatchesChain(address, plan.chainId)),
      liveAddressConcurrency,
      async (address) => {
        try {
          const events = await adapter.getEvents({ address });
          return { events, source: adapter.id };
        } catch (error) {
          if (input.dataMode === "auto" && plan.fallbackProvider === "etherscan-v2") {
            const fallbackAdapter = buildAdapter({
              plan: { chainId: plan.chainId, provider: plan.fallbackProvider },
              configName: config.name,
              etherscanApiKey,
              nodeRealApiKey,
              nodeRealBscApiKey,
              solscanApiKey,
              fetchImpl: input.fetchImpl,
            });
            const events = await fallbackAdapter.getEvents({ address });
            return { events, source: `${fallbackAdapter.id}:fallback-from-nodereal` };
          }

          if (allowPartial) {
            return {
              events: [],
              warning: `${config.name} skipped: ${error instanceof Error ? error.message : "provider request failed"}`,
            };
          }

          throw error;
        }
      },
    );

    for (const result of addressResults) {
      eventsByAddress.push(result.events);

      if (result.source) {
        sources.add(result.source);
      }

      if (result.warning) {
        warnings.push(result.warning);
      }
    }

    sources.add(adapter.id);
  }

  return {
    events: dedupeEvents(eventsByAddress.flat()),
    mode: "live",
    source: Array.from(sources).join(",") || "live-partial-empty",
    chainName: buildChainName(requestedChainIds),
    warnings,
  };
}

export function selectAnalyzeLiveProvider(
  chainId: ChainId,
  input: {
    dataProvider: AnalyzeDataProvider;
    etherscanApiKey?: string;
    nodeRealApiKey?: string;
    nodeRealBscApiKey?: string;
    solscanApiKey?: string;
  },
): LiveProviderPlan {
  const chain = getSupportedAnalysisChain(chainId);

  if (chain?.ecosystem === "solana") {
    return {
      chainId,
      provider: input.solscanApiKey && (input.dataProvider === "auto" || input.dataProvider === "solscan")
        ? "solscan"
        : null,
    };
  }

  if (
    input.nodeRealApiKey &&
    nodeRealEndpoints.has(chainId) &&
    (input.dataProvider === "auto" || input.dataProvider === "nodereal")
  ) {
    const fallbackProvider =
      input.dataProvider === "auto" && input.etherscanApiKey && chain?.ecosystem === "evm"
        ? "etherscan-v2"
        : undefined;

    return {
      chainId,
      provider: "nodereal",
      ...(fallbackProvider ? { fallbackProvider } : {}),
    };
  }

  if (input.etherscanApiKey && (input.dataProvider === "auto" || input.dataProvider === "etherscan")) {
    return { chainId, provider: "etherscan-v2" };
  }

  return { chainId, provider: null };
}

function buildAdapter(input: {
  plan: LiveProviderPlan;
  configName: string;
  etherscanApiKey?: string;
  nodeRealApiKey?: string;
  nodeRealBscApiKey?: string;
  solscanApiKey?: string;
  fetchImpl?: typeof fetch;
}): ChainAdapter {
  if (input.plan.provider === "nodereal") {
    const apiKey = input.nodeRealApiKey ?? input.nodeRealBscApiKey ?? "";
    const endpoint = nodeRealEndpoints.get(input.plan.chainId);

    if (!endpoint) {
      throw new Error(`NodeReal is not configured for chain ID ${input.plan.chainId}.`);
    }

    return new NodeRealEvmAdapter({
      apiKey,
      chainId: input.plan.chainId,
      name: `NodeReal ${input.configName}`,
      baseUrl: endpoint.replace("{apiKey}", apiKey),
      requestThrottleMs: 200,
      maxRateLimitRetries: 3,
      fetchImpl: input.fetchImpl,
    });
  }

  if (input.plan.provider === "solscan") {
    return new SolscanAdapter({
      apiKey: input.solscanApiKey ?? "",
      requestThrottleMs: 200,
      fetchImpl: input.fetchImpl,
    });
  }

  return buildEtherscanAdapter(input.plan.chainId, input.configName, input.etherscanApiKey, input.fetchImpl);
}

function buildEtherscanAdapter(
  chainId: ChainId,
  chainName: string,
  apiKey: string | undefined,
  fetchImpl: typeof fetch | undefined,
): EtherscanLikeAdapter {
  return new EtherscanLikeAdapter({
    baseUrl: etherscanV2BaseUrl,
    apiKey,
    chainId,
    name: chainName,
    useChainIdParam: true,
    requestThrottleMs: 350,
    maxRateLimitRetries: 3,
    fetchImpl,
  });
}

function buildMissingLiveConfigMessage(chainIds: ChainId[], provider: AnalyzeDataProvider): string {
  const keyHint =
    provider === "nodereal"
      ? `${nodeRealApiKeyEnv} or ${nodeRealBscApiKeyEnv}`
      : provider === "solscan"
        ? solscanApiKeyEnv
        : provider === "etherscan"
          ? etherscanApiKeyEnv
          : `${nodeRealApiKeyEnv}, ${nodeRealBscApiKeyEnv}, ${etherscanApiKeyEnv}, or ${solscanApiKeyEnv}`;

  return `${keyHint} is not configured for ${buildChainName(chainIds)}, so Auto mode used fixture data instead.`;
}

function buildMissingLiveRequirementMessage(
  chainName: string,
  chainId: ChainId,
  provider: AnalyzeDataProvider,
): string {
  if (chainId === 101 || provider === "solscan") {
    return `${solscanApiKeyEnv} is required for live ${chainName} analysis.`;
  }

  if (provider === "nodereal") {
    return `${nodeRealApiKeyEnv} or ${nodeRealBscApiKeyEnv} is required for live ${chainName} analysis.`;
  }

  if (provider === "etherscan") {
    return `${etherscanApiKeyEnv} is required for live ${chainName} analysis.`;
  }

  return `${nodeRealApiKeyEnv}, ${nodeRealBscApiKeyEnv}, or ${etherscanApiKeyEnv} is required for live ${chainName} analysis.`;
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

function buildChainName(chainIds: ChainId[]): string {
  if (chainIds.length > 1) {
    return "EVM Aggregate";
  }

  const chainId = chainIds[0] ?? 1;
  return getSupportedAnalysisChain(chainId)?.name ?? `Chain ${chainId}`;
}

function addressMatchesChain(address: Address, chainId: ChainId): boolean {
  if (chainId === 101) {
    return !address.startsWith("0x");
  }

  return address.startsWith("0x");
}

function parseLiveAddressConcurrency(input: string | undefined): number {
  const parsed = Number(input ?? defaultLiveAddressConcurrency);

  if (!Number.isFinite(parsed)) {
    return defaultLiveAddressConcurrency;
  }

  return Math.min(maxLiveAddressConcurrency, Math.max(1, Math.floor(parsed)));
}

export async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
  if (items.length === 0) {
    return [];
  }

  const workerCount = Math.min(items.length, Math.max(1, Math.floor(concurrency)));
  const results = new Array<TOutput>(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(items[index] as TInput, index);
      }
    }),
  );

  return results;
}
