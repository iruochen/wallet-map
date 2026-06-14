import { describe, expect, it } from "vitest";
import { createAnalyzeLabelProviders } from "./label-providers";

describe("createAnalyzeLabelProviders", () => {
  it("uses built-in known entity and event asset labels by default", () => {
    const providers = createAnalyzeLabelProviders({});

    expect(providers.map((provider) => provider.id)).toEqual([
      "known-entity-labels",
      "normalized-event-asset",
    ]);
  });

  it("adds Chainbase labels when an API key is configured", () => {
    const providers = createAnalyzeLabelProviders({
      CHAINBASE_API_KEY: "test-key",
    });

    expect(providers.map((provider) => provider.id)).toEqual([
      "chainbase-address-labels",
      "known-entity-labels",
      "normalized-event-asset",
    ]);
  });

  it("can skip live label providers for fixture analysis", () => {
    const providers = createAnalyzeLabelProviders(
      {
        CHAINBASE_API_KEY: "test-key",
        ETHERSCAN_API_KEY: "test-key",
        ETHERSCAN_NAMETAG_ENABLED: "true",
      },
      { includeLiveProviders: false },
    );

    expect(providers.map((provider) => provider.id)).toEqual([
      "known-entity-labels",
      "normalized-event-asset",
    ]);
  });

  it("adds Etherscan nametag lookup only when explicitly enabled", () => {
    const providers = createAnalyzeLabelProviders({
      ETHERSCAN_API_KEY: "test-key",
      ETHERSCAN_NAMETAG_ENABLED: "true",
    });

    expect(providers.map((provider) => provider.id)).toEqual([
      "etherscan-nametag",
      "known-entity-labels",
      "normalized-event-asset",
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
      "known-entity-labels",
      "normalized-event-asset",
    ]);
  });
});
