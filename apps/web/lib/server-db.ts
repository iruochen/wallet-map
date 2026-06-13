import { Pool } from "pg";
import { createClient, type RedisClientType } from "redis";
import { readPostgresEnabled, readRedisEnabled } from "./feature-config";

let pool: Pool | undefined;
let redisClient: RedisClientType | undefined;
let redisConnectPromise: Promise<RedisClientType | undefined> | undefined;

export function getPostgresPool(): Pool | undefined {
  if (!readPostgresEnabled()) {
    return undefined;
  }

  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    return undefined;
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 8,
    });
  }

  return pool;
}

export async function getRedisClient(): Promise<RedisClientType | undefined> {
  if (!readRedisEnabled()) {
    return undefined;
  }

  const url = process.env.REDIS_URL?.trim();

  if (!url) {
    return undefined;
  }

  if (!redisClient) {
    redisClient = createClient({ url });
    redisClient.on("error", () => undefined);
  }

  if (!redisConnectPromise) {
    redisConnectPromise = redisClient
      .connect()
      .then(() => redisClient)
      .catch(() => undefined);
  }

  return redisConnectPromise;
}

export async function closeServerDbConnectionsForTests(): Promise<void> {
  if (redisClient?.isOpen) {
    await redisClient.quit().catch(() => undefined);
  }

  redisClient = undefined;
  redisConnectPromise = undefined;
  await pool?.end().catch(() => undefined);
  pool = undefined;
}
