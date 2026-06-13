import { createClient, type RedisClientType } from "redis";
import type { KnownLabelListResult } from "@wallet-map/storage";
import { readLabelListCacheEnabled } from "../../../lib/feature-config";

const labelListCachePrefix = "wallet-map:label-list:";
const defaultTtlSeconds = 30;

let redisClient: RedisClientType | undefined;
let redisConnectPromise: Promise<RedisClientType | undefined> | undefined;

export async function readCachedLabelList(
  cacheKey: string,
  env: Record<string, string | undefined> = process.env,
): Promise<KnownLabelListResult | undefined> {
  const client = await getRedisClient(env);

  if (!client) {
    return undefined;
  }

  try {
    const cached = await client.get(`${labelListCachePrefix}${cacheKey}`);

    if (!cached) {
      return undefined;
    }

    return JSON.parse(cached) as KnownLabelListResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[labels] failed to read list cache:", message);
    return undefined;
  }
}

export async function writeCachedLabelList(
  cacheKey: string,
  payload: KnownLabelListResult,
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const client = await getRedisClient(env);

  if (!client) {
    return;
  }

  try {
    await client.set(`${labelListCachePrefix}${cacheKey}`, JSON.stringify(payload), {
      EX: defaultTtlSeconds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[labels] failed to write list cache:", message);
  }
}

export async function invalidateLabelListCache(
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const client = await getRedisClient(env);

  if (!client) {
    return;
  }

  try {
    const keys = await client.keys(`${labelListCachePrefix}*`);

    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[labels] failed to invalidate list cache:", message);
  }
}

export function buildLabelListCacheKey(query: {
  chainId?: number;
  sourceMode?: string;
  query?: string;
  limit: number;
  offset: number;
}): string {
  return [
    query.chainId ?? "all",
    query.sourceMode ?? "all",
    query.query ?? "",
    query.limit,
    query.offset,
  ].join(":");
}

async function getRedisClient(
  env: Record<string, string | undefined>,
): Promise<RedisClientType | undefined> {
  const redisUrl = env.REDIS_URL?.trim();

  if (!redisUrl || !readLabelListCacheEnabled(env)) {
    return undefined;
  }

  if (redisClient?.isOpen) {
    return redisClient;
  }

  if (!redisConnectPromise) {
    redisConnectPromise = (async () => {
      const client = createClient({ url: redisUrl }) as RedisClientType;
      client.on("error", (error) => {
        console.error("[labels] redis list cache error:", error.message);
      });
      await client.connect();
      redisClient = client;
      return client;
    })();
  }

  return redisConnectPromise;
}
