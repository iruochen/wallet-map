import { describe, expect, it } from "vitest";
import { createAnalyzeLabelProviders } from "./label-providers";

describe("createAnalyzeLabelProviders", () => {
  it("uses the static registry by default", () => {
    const providers = createAnalyzeLabelProviders({});

    expect(providers.map((provider) => provider.id)).toEqual(["static-label-registry"]);
  });

  it("adds Chainbase labels when an API key is configured", () => {
    const providers = createAnalyzeLabelProviders({
      CHAINBASE_API_KEY: "test-key",
    });

    expect(providers.map((provider) => provider.id)).toEqual([
      "chainbase-address-labels",
      "static-label-registry",
    ]);
  });

  it("adds Etherscan nametag lookup only when explicitly enabled", () => {
    const providers = createAnalyzeLabelProviders({
      ETHERSCAN_API_KEY: "test-key",
      ETHERSCAN_NAMETAG_ENABLED: "true",
    });

    expect(providers.map((provider) => provider.id)).toEqual([
      "etherscan-nametag",
      "static-label-registry",
    ]);
  });

  it("adds cache and persistence providers before live providers", () => {
    const providers = createAnalyzeLabelProviders({
      DATABASE_URL: "postgresql://wallet_map:wallet_map@localhost:5432/wallet_map",
      REDIS_URL: "redis://localhost:6379",
      CHAINBASE_API_KEY: "test-key",
    });

    expect(providers.map((provider) => provider.id)).toEqual([
      "postgres-known-labels",
      "redis-label-cache",
      "chainbase-address-labels:persisting",
      "static-label-registry",
    ]);
  });
});
