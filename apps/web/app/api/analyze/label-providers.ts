import {
  createChainbaseLabelProvider,
  createEtherscanNametagProvider,
  createPersistingLabelProvider,
  createStaticLabelProvider,
  type LabelSink,
  type LabelProvider,
} from "@wallet-map/labels";
import { createPostgresLabelRepository } from "@wallet-map/storage";
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
const labelDatabaseEnabledEnv = "LABEL_DATABASE_ENABLED";
const redisUrlEnv = "REDIS_URL";
const labelRedisCacheEnabledEnv = "LABEL_REDIS_CACHE_ENABLED";

export function createAnalyzeLabelProviders(
  env: Record<string, string | undefined> = process.env,
): LabelProvider[] {
  const providers: LabelProvider[] = [];
  const sinks: LabelSink[] = [];
  const etherscanApiKey = env[etherscanApiKeyEnv]?.trim();
  const chainbaseApiKey = env[chainbaseApiKeyEnv]?.trim();

  if (env[databaseUrlEnv] && env[labelDatabaseEnabledEnv] !== "false") {
    const repository = createPostgresLabelRepository({
      connectionString: env[databaseUrlEnv],
    });

    providers.push(createRepositoryLabelProvider(repository));
    sinks.push(createRepositoryLabelSink(repository));
  }

  if (env[redisUrlEnv] && env[labelRedisCacheEnabledEnv] !== "false") {
    const redisCache = createRedisLabelProvider({
      url: env[redisUrlEnv],
    });

    providers.push(redisCache);
    sinks.push(redisCache);
  }

  if (chainbaseApiKey && env[chainbaseLabelsEnabledEnv] !== "false") {
    const provider = createChainbaseLabelProvider({
      apiKey: chainbaseApiKey,
      onError: () => undefined,
    });

    providers.push(
      sinks.length > 0
        ? createPersistingLabelProvider({
            provider,
            sinks,
            onError: () => undefined,
          })
        : provider,
    );
  }

  if (etherscanApiKey && env[etherscanNametagEnabledEnv] === "true") {
    const provider = createEtherscanNametagProvider({
      apiKey: etherscanApiKey,
      onError: () => undefined,
    });

    providers.push(
      sinks.length > 0
        ? createPersistingLabelProvider({
            provider,
            sinks,
            onError: () => undefined,
          })
        : provider,
    );
  }

  providers.push(createStaticLabelProvider());

  return providers;
}
