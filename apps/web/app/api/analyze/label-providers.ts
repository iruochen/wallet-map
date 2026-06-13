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
const databaseUrlEnv = "DATABASE_URL";
const redisUrlEnv = "REDIS_URL";

export interface AnalyzeLabelStack {
  providers: LabelProvider[];
  sinks: LabelSink[];
}

export function createAnalyzeLabelStack(
  env: Record<string, string | undefined> = process.env,
): AnalyzeLabelStack {
  const providers: LabelProvider[] = [];
  const sinks: LabelSink[] = [];
  const etherscanApiKey = env[etherscanApiKeyEnv]?.trim();
  const chainbaseApiKey = env[chainbaseApiKeyEnv]?.trim();
  const connectionString = env[databaseUrlEnv]?.trim();
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

  if (chainbaseApiKey && env[chainbaseLabelsEnabledEnv] !== "false") {
    const provider = createChainbaseLabelProvider({
      apiKey: chainbaseApiKey,
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

  if (etherscanApiKey && env[etherscanNametagEnabledEnv] === "true") {
    const provider = createEtherscanNametagProvider({
      apiKey: etherscanApiKey,
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
): LabelProvider[] {
  return createAnalyzeLabelStack(env).providers;
}
