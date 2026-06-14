import {
  createChainbaseLabelProvider,
  createEtherscanNametagProvider,
  createEventAssetLabelProvider,
  createKnownEntityLabelProvider,
  createPersistingLabelProvider,
  type LabelSink,
  type LabelProvider,
} from "@wallet-map/labels";
import { Pool } from "pg";
import { createPostgresLabelRepository } from "@wallet-map/storage";
import {
  readLabelDatabaseEnabled,
  readLabelRedisCacheEnabled,
  readPostgresEnabled,
} from "../../../lib/feature-config";
import { getPostgresPool } from "../../../lib/server-db";
import {
  createRedisLabelProvider,
  createRepositoryLabelProvider,
  createRepositoryLabelSink,
} from "./label-storage";

const etherscanApiKeyEnv = "ETHERSCAN_API_KEY";
const etherscanNametagEnabledEnv = "ETHERSCAN_NAMETAG_ENABLED";
const chainbaseApiKeyEnv = "CHAINBASE_API_KEY";
const chainbaseLabelsEnabledEnv = "CHAINBASE_LABELS_ENABLED";
const liveLabelProviderTimeoutEnv = "ANALYZE_LIVE_LABEL_TIMEOUT_MS";
const liveLabelMaxAddressesEnv = "ANALYZE_LIVE_LABEL_MAX_ADDRESSES";
const databaseUrlEnv = "DATABASE_URL";
const redisUrlEnv = "REDIS_URL";
const defaultLiveLabelProviderTimeoutMs = 1_500;
const maxLiveLabelProviderTimeoutMs = 30_000;
const defaultLiveLabelMaxAddresses = 8;
const maxLiveLabelMaxAddresses = 50;

export interface AnalyzeLabelStack {
  providers: LabelProvider[];
  sinks: LabelSink[];
}

export interface AnalyzeLabelStackOptions {
  includeLiveProviders?: boolean;
}

export function createAnalyzeLabelStack(
  env: Record<string, string | undefined> = process.env,
  options: AnalyzeLabelStackOptions = {},
): AnalyzeLabelStack {
  const providers: LabelProvider[] = [];
  const sinks: LabelSink[] = [];
  const includeLiveProviders = options.includeLiveProviders ?? true;
  const etherscanApiKey = env[etherscanApiKeyEnv]?.trim();
  const chainbaseApiKey = env[chainbaseApiKeyEnv]?.trim();
  const connectionString = env[databaseUrlEnv]?.trim();
  const liveLabelTimeoutMs = parseLiveLabelProviderTimeoutMs(env[liveLabelProviderTimeoutEnv]);
  const liveLabelMaxAddresses = parseLiveLabelMaxAddresses(env[liveLabelMaxAddressesEnv]);
  const pool =
    getPostgresPool() ??
    (readPostgresEnabled(env) && connectionString
      ? new Pool({
          connectionString,
          max: 4,
        })
      : undefined);

  if (pool && readLabelDatabaseEnabled(env)) {
    const repository = createPostgresLabelRepository({ pool });

    providers.push(createRepositoryLabelProvider(repository));
    sinks.push(createRepositoryLabelSink(repository));
  }

  if (env[redisUrlEnv] && readLabelRedisCacheEnabled(env)) {
    const redisCache = createRedisLabelProvider({
      url: env[redisUrlEnv]!,
    });

    providers.push(redisCache);
    sinks.push(redisCache);
  }

  if (includeLiveProviders && chainbaseApiKey && env[chainbaseLabelsEnabledEnv] !== "false") {
    const provider = createChainbaseLabelProvider({
      apiKey: chainbaseApiKey,
      fetchImpl: withLiveLabelTimeout(undefined, liveLabelTimeoutMs, "Chainbase"),
      maxAddresses: liveLabelMaxAddresses,
      onError: (error) => {
        console.error("[labels] chainbase lookup failed:", error.message);
      },
    });

    providers.push(
      sinks.length > 0
        ? createPersistingLabelProvider({
            provider,
            sinks,
            onError: (error) => {
              console.error("[labels] failed to persist chainbase labels:", error.message);
            },
          })
        : provider,
    );
  }

  if (includeLiveProviders && etherscanApiKey && env[etherscanNametagEnabledEnv] === "true") {
    const provider = createEtherscanNametagProvider({
      apiKey: etherscanApiKey,
      fetchImpl: withLiveLabelTimeout(undefined, liveLabelTimeoutMs, "Etherscan nametag"),
      maxAddresses: liveLabelMaxAddresses,
      onError: (error) => {
        console.error("[labels] etherscan nametag lookup failed:", error.message);
      },
    });

    providers.push(
      sinks.length > 0
        ? createPersistingLabelProvider({
            provider,
            sinks,
            onError: (error) => {
              console.error("[labels] failed to persist etherscan labels:", error.message);
            },
          })
        : provider,
    );
  }

  providers.push(createKnownEntityLabelProvider());
  providers.push(createEventAssetLabelProvider());

  return { providers, sinks };
}

export function createAnalyzeLabelProviders(
  env: Record<string, string | undefined> = process.env,
  options: AnalyzeLabelStackOptions = {},
): LabelProvider[] {
  return createAnalyzeLabelStack(env, options).providers;
}

function parseLiveLabelProviderTimeoutMs(input: string | undefined): number {
  const parsed = Number(input ?? defaultLiveLabelProviderTimeoutMs);

  if (!Number.isFinite(parsed)) {
    return defaultLiveLabelProviderTimeoutMs;
  }

  return Math.min(maxLiveLabelProviderTimeoutMs, Math.max(250, Math.floor(parsed)));
}

function parseLiveLabelMaxAddresses(input: string | undefined): number {
  const parsed = Number(input ?? defaultLiveLabelMaxAddresses);

  if (!Number.isFinite(parsed)) {
    return defaultLiveLabelMaxAddresses;
  }

  return Math.min(maxLiveLabelMaxAddresses, Math.max(1, Math.floor(parsed)));
}

function withLiveLabelTimeout(
  fetchImpl: typeof fetch | undefined,
  timeoutMs: number,
  providerName: string,
): typeof fetch {
  const baseFetch = fetchImpl ?? globalThis.fetch;

  return async (input, init) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        baseFetch(input, init),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            reject(new Error(`${providerName} label request timed out after ${timeoutMs}ms.`));
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
