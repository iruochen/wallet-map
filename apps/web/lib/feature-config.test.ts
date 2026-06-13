import { describe, expect, it } from "vitest";
import {
  readBooleanFlag,
  readLabelDatabaseEnabled,
  readLabelListCacheEnabled,
  readLabelManagerEnabled,
  readLabelRedisCacheEnabled,
  readPostgresEnabled,
  readRedisEnabled,
} from "./feature-config";

describe("feature config", () => {
  it("parses common boolean flag values", () => {
    expect(readBooleanFlag("true", false)).toBe(true);
    expect(readBooleanFlag("1", false)).toBe(true);
    expect(readBooleanFlag("enabled", false)).toBe(true);
    expect(readBooleanFlag("false", true)).toBe(false);
    expect(readBooleanFlag("0", true)).toBe(false);
    expect(readBooleanFlag("off", true)).toBe(false);
    expect(readBooleanFlag("", true)).toBe(true);
    expect(readBooleanFlag("unknown", false)).toBe(false);
  });

  it("leaves storage integrations enabled unless explicitly disabled", () => {
    expect(readPostgresEnabled({})).toBe(true);
    expect(readRedisEnabled({})).toBe(true);
    expect(readLabelDatabaseEnabled({})).toBe(true);
    expect(readLabelRedisCacheEnabled({})).toBe(true);
    expect(readLabelListCacheEnabled({})).toBe(true);
  });

  it("allows storage and label caches to be disabled independently", () => {
    expect(readPostgresEnabled({ STORAGE_POSTGRES_ENABLED: "false" })).toBe(false);
    expect(readRedisEnabled({ STORAGE_REDIS_ENABLED: "false" })).toBe(false);
    expect(readLabelDatabaseEnabled({ STORAGE_POSTGRES_ENABLED: "false" })).toBe(false);
    expect(readLabelDatabaseEnabled({ LABEL_DATABASE_ENABLED: "false" })).toBe(false);
    expect(readLabelRedisCacheEnabled({ STORAGE_REDIS_ENABLED: "false" })).toBe(false);
    expect(readLabelRedisCacheEnabled({ LABEL_REDIS_CACHE_ENABLED: "false" })).toBe(false);
    expect(readLabelListCacheEnabled({ LABEL_LIST_CACHE_ENABLED: "false" })).toBe(false);
  });

  it("keeps the label manager private by default", () => {
    expect(readLabelManagerEnabled({})).toBe(false);
    expect(readLabelManagerEnabled({ NEXT_PUBLIC_LABEL_MANAGER_ENABLED: "true" })).toBe(true);
  });
});
