import { EtherscanLikeAdapter, NodeRealEvmAdapter, resolveAnalyzeFetchPlan, SolscanAdapter } from "@wallet-map/adapters";
import type { ChainAdapter } from "@wallet-map/adapters";
import type { Address, ChainId, FetchPlan, HistoryScope, NormalizedEvent } from "@wallet-map/core";
import { getSupportedAnalysisChain } from "../../chains";
import fixtureEvents from "../../../../../fixtures/sample-events.json";
import type { AnalyzeDataMode, AnalyzeDataProvider } from "./schema";

export interface AnalyzeFetchCoverage {
  scope: HistoryScope;
  historyDays?: number;
  maxEventsPerAddress: number;
  eventsPerAddress: Record<string, number>;
  truncatedAddresses: Address[];
}

export interface ResolveEventsInput {
  addresses: Address[];
  chainId: ChainId;
  chainIds?: ChainId[];
  dataMode: AnalyzeDataMode;
  dataProvider?: AnalyzeDataProvider;
  historyScope?: HistoryScope;
  historyDays?: number;
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
  fetchCoverage?: AnalyzeFetchCoverage;
  fetchPlan?: FetchPlan & { historyDays?: number };
}

type LiveProviderId = "etherscan-v2" | "nodereal" | "solscan";
type AddressProviderResult = {
  events: NormalizedEvent[];
  source?: string;
  warning?: string;
  truncated?: boolean;
  eventCount?: number;
};

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
const liveChainConcurrencyEnv = "ANALYZE_LIVE_CHAIN_CONCURRENCY";
const liveProviderTimeoutEnv = "ANALYZE_LIVE_PROVIDER_TIMEOUT_MS";
const defaultLiveAddressConcurrency = 2;
const maxLiveAddressConcurrency = 8;
const defaultLiveChainConcurrency = 3;
const maxLiveChainConcurrency = 6;
const defaultLiveProviderTimeoutMs = 20_000;
const maxLiveProviderTimeoutMs = 120_000;

const nodeRealEndpoints = new Map<ChainId, string>([
  [1, "https://eth-mainnet.nodereal.io/v1/{apiKey}"],
  [56, "https://bsc-mainnet.nodereal.io/v1/{apiKey}"],
]);

// Fetch step entry point. Always returns NormalizedEvent[] for the analysis pipeline.
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
  const liveChainConcurrency = parseLiveChainConcurrency(env[liveChainConcurrencyEnv]);
  const liveProviderTimeoutMs = parseLiveProviderTimeoutMs(env[liveProviderTimeoutEnv]);
  const fetchPlan = resolveAnalyzeFetchPlan({
    historyScope: input.historyScope,
    historyDays: input.historyDays,
    env,
  });
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

  // No API keys (or explicit fixture mode) -> read from fixtures/sample-events.json.
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

  const allowPartial = requestedChainIds.length > 1;
  const coverageTracker = createFetchCoverageTracker(fetchPlan);

  // Live mode: pick an adapter per chain, then call adapter.getEvents for each address.
  const chainResults = await mapWithConcurrency(livePlans, liveChainConcurrency, async (plan) => {
    const eventsByAddress: NormalizedEvent[][] = [];
    const sources = new Set<string>();
    const warnings: string[] = [];
    const config = getSupportedAnalysisChain(plan.chainId);
    if (!config) {
      return { events: [], sources: [], warnings };
    }

    if (!plan.provider && input.dataMode === "live") {
      if (allowPartial) {
        warnings.push(buildMissingLiveRequirementMessage(config.name, plan.chainId, dataProvider));
        return { events: [], sources: [], warnings };
      }

      throw new Error(buildMissingLiveRequirementMessage(config.name, plan.chainId, dataProvider));
    }

    if (!plan.provider) {
      warnings.push(buildMissingLiveRequirementMessage(config.name, plan.chainId, dataProvider));
      return { events: [], sources: [], warnings };
    }

    const adapter = buildAdapter({
      plan,
      configName: config.name,
      etherscanApiKey,
      nodeRealApiKey,
      nodeRealBscApiKey,
      solscanApiKey,
      fetchImpl: withProviderTimeout(input.fetchImpl, liveProviderTimeoutMs, config.name),
    });

    const addressResults = await mapWithConcurrency(
      input.addresses.filter((address) => addressMatchesChain(address, plan.chainId)),
      liveAddressConcurrency,
      async (address) => {
        try {
          const result = await adapter.getEvents({ address, fetchPlan });
          coverageTracker.record(address, result.events.length, result.coverage.truncated);
          if (result.coverage.truncated) {
            return {
              events: result.events,
              source: adapter.id,
              warning: buildTruncationWarning(address, result.coverage.reason, fetchPlan),
              truncated: true,
              eventCount: result.events.length,
            };
          }

          return { events: result.events, source: adapter.id, eventCount: result.events.length };
        } catch (error) {
          if (plan.fallbackProvider) {
            const fallbackResult: AddressProviderResult | undefined = await fetchFallbackEvents({
              address,
              failedProvider: plan.provider,
              fallbackProvider: plan.fallbackProvider,
              chainId: plan.chainId,
              configName: config.name,
              etherscanApiKey,
              nodeRealApiKey,
              nodeRealBscApiKey,
              solscanApiKey,
              fetchImpl: input.fetchImpl,
              timeoutMs: liveProviderTimeoutMs,
              fetchPlan,
            }).catch((fallbackError: unknown) => {
              return {
                events: [],
                warning: buildProviderFailureMessage(config.name, error, fallbackError),
              };
            });

            if (fallbackResult) {
              return fallbackResult;
            }
          }

          return {
            events: [],
            warning: `${config.name} skipped: ${formatUnknownError(error)}`,
          };
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

    return {
      events: eventsByAddress.flat(),
      sources: Array.from(sources),
      warnings,
    };
  });

  return {
    events: dedupeEvents(chainResults.flatMap((result) => result.events)),
    mode: "live",
    source: Array.from(new Set(chainResults.flatMap((result) => result.sources))).join(",") || "live-partial-empty",
    chainName: buildChainName(requestedChainIds),
    warnings: [
      ...chainResults.flatMap((result) => result.warnings),
      ...coverageTracker.buildScopeWarnings(),
    ],
    fetchCoverage: coverageTracker.snapshot(),
    fetchPlan,
  };
}

function buildProviderFailureMessage(
  chainName: string,
  primaryError: unknown,
  fallbackError?: unknown,
): string {
  const primaryMessage = formatUnknownError(primaryError);

  if (!fallbackError) {
    return `${chainName} skipped: ${primaryMessage}`;
  }

  return `${chainName} provider request failed: ${primaryMessage} Fallback also failed: ${formatUnknownError(fallbackError)}`;
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : "provider request failed";
}

function buildTruncationWarning(
  address: Address,
  reason: string | undefined,
  fetchPlan: FetchPlan & { historyDays?: number },
): string {
  const scopeHint =
    fetchPlan.scope === "window" && fetchPlan.historyDays
      ? `last ${fetchPlan.historyDays} days`
      : fetchPlan.scope === "full"
        ? "full history"
        : "configured window";
  const detail = reason ? ` ${reason}` : "";
  return `${address} fetch was truncated (${scopeHint}).${detail}`;
}

function createFetchCoverageTracker(fetchPlan: FetchPlan & { historyDays?: number }) {
  const eventsPerAddress: Record<string, number> = {};
  const truncatedAddresses: Address[] = [];

  return {
    record(address: Address, count: number, truncated: boolean) {
      eventsPerAddress[address] = count;
      if (truncated) {
        truncatedAddresses.push(address);
      }
    },
    snapshot(): AnalyzeFetchCoverage {
      return {
        scope: fetchPlan.scope,
        historyDays: fetchPlan.historyDays,
        maxEventsPerAddress: fetchPlan.maxEventsPerAddress ?? 10_000,
        eventsPerAddress,
        truncatedAddresses,
      };
    },
    buildScopeWarnings(): string[] {
      if (fetchPlan.scope === "window" && fetchPlan.historyDays) {
        return [`Live analysis uses the last ${fetchPlan.historyDays} days of on-chain history.`];
      }

      return [];
    },
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
    const fallbackProvider =
      input.nodeRealApiKey &&
      nodeRealEndpoints.has(chainId) &&
      chain?.ecosystem === "evm"
        ? "nodereal"
        : undefined;

    return {
      chainId,
      provider: "etherscan-v2",
      ...(fallbackProvider ? { fallbackProvider } : {}),
    };
  }

  return { chainId, provider: null };
}

// Factory: pick Etherscan, NodeReal, or Solscan adapter based on provider plan.
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

async function fetchFallbackEvents(input: {
  address: Address;
  failedProvider: LiveProviderId | null;
  fallbackProvider: LiveProviderId;
  chainId: ChainId;
  configName: string;
  etherscanApiKey?: string;
  nodeRealApiKey?: string;
  nodeRealBscApiKey?: string;
  solscanApiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs: number;
  fetchPlan?: FetchPlan & { historyDays?: number };
}): Promise<AddressProviderResult | undefined> {
  if (!input.failedProvider) {
    return undefined;
  }

  const fallbackAdapter = buildAdapter({
    plan: { chainId: input.chainId, provider: input.fallbackProvider },
    configName: input.configName,
    etherscanApiKey: input.etherscanApiKey,
    nodeRealApiKey: input.nodeRealApiKey,
    nodeRealBscApiKey: input.nodeRealBscApiKey,
    solscanApiKey: input.solscanApiKey,
    fetchImpl: withProviderTimeout(input.fetchImpl, input.timeoutMs, input.configName),
  });
  const events = await fallbackAdapter.getEvents({ address: input.address, fetchPlan: input.fetchPlan });

  return {
    events: events.events,
    source: `${fallbackAdapter.id}:fallback-from-${formatProviderSourceSlug(input.failedProvider)}`,
    truncated: events.coverage.truncated,
    eventCount: events.events.length,
    ...(events.coverage.truncated
      ? {
          warning: buildTruncationWarning(
            input.address,
            events.coverage.reason,
            input.fetchPlan ?? resolveAnalyzeFetchPlan(),
          ),
        }
      : {}),
  };
}

function formatProviderSourceSlug(provider: LiveProviderId): string {
  return provider === "etherscan-v2" ? "etherscan" : provider;
}

function withProviderTimeout(
  fetchImpl: typeof fetch | undefined,
  timeoutMs: number,
  chainName: string,
): typeof fetch {
  const baseFetch = fetchImpl ?? globalThis.fetch;

  return async (input, init) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        baseFetch(input, init),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            reject(new Error(`${chainName} provider request timed out after ${timeoutMs}ms.`));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  };
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

function parseLiveChainConcurrency(input: string | undefined): number {
  const parsed = Number(input ?? defaultLiveChainConcurrency);

  if (!Number.isFinite(parsed)) {
    return defaultLiveChainConcurrency;
  }

  return Math.min(maxLiveChainConcurrency, Math.max(1, Math.floor(parsed)));
}

function parseLiveProviderTimeoutMs(input: string | undefined): number {
  const parsed = Number(input ?? defaultLiveProviderTimeoutMs);

  if (!Number.isFinite(parsed)) {
    return defaultLiveProviderTimeoutMs;
  }

  return Math.min(maxLiveProviderTimeoutMs, Math.max(1, Math.floor(parsed)));
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
