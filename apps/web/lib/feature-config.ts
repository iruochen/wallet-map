const falseValues = new Set(["0", "false", "off", "no", "disabled"]);
const trueValues = new Set(["1", "true", "on", "yes", "enabled"]);

export function readBooleanFlag(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return defaultValue;
  }

  if (falseValues.has(normalized)) {
    return false;
  }

  if (trueValues.has(normalized)) {
    return true;
  }

  return defaultValue;
}

export function readPostgresEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return readBooleanFlag(env.STORAGE_POSTGRES_ENABLED, true);
}

export function readRedisEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return readBooleanFlag(env.STORAGE_REDIS_ENABLED, true);
}

export function readLabelDatabaseEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return readBooleanFlag(env.LABEL_DATABASE_ENABLED, true) && readPostgresEnabled(env);
}

export function readLabelRedisCacheEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return readBooleanFlag(env.LABEL_REDIS_CACHE_ENABLED, true) && readRedisEnabled(env);
}

export function readLabelListCacheEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return readBooleanFlag(env.LABEL_LIST_CACHE_ENABLED, true) && readRedisEnabled(env);
}

export function readLabelManagerEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return readBooleanFlag(env.NEXT_PUBLIC_LABEL_MANAGER_ENABLED, false);
}
