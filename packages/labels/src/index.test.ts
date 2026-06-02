import type { GraphNode, NormalizedEvent, RelationshipGraph } from "@wallet-map/core";
import { describe, expect, it } from "vitest";
import {
  createChainbaseLabelProvider,
  createEtherscanNametagProvider,
  createLabelGraphEnricher,
  createPersistingLabelProvider,
  createStaticLabelProvider,
  enrichGraphWithLabels,
  type NodeLabel,
} from "./index";

describe("label enrichment", () => {
  it("labels contract nodes from normalized event asset metadata", async () => {
    const graph: RelationshipGraph = {
      nodes: [
        {
          id: "contract:56:0xcccccccccccccccccccccccccccccccccccccccc",
          kind: "contract",
          address: "0xcccccccccccccccccccccccccccccccccccccccc",
          chainId: 56,
        },
      ],
      edges: [],
    };
    const events: NormalizedEvent[] = [
      {
        id: "event:1",
        type: "token_transfer",
        chainId: 56,
        txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        blockNumber: 1,
        timestamp: "2024-01-01T00:00:00.000Z",
        from: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        to: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        asset: {
          kind: "erc20",
          chainId: 56,
          symbol: "MOCK",
          contract: "0xcccccccccccccccccccccccccccccccccccccccc",
        },
      },
    ];

    const enriched = await enrichGraphWithLabels(graph, events, [createStaticLabelProvider([])]);

    expect(enriched.nodes).toEqual([
      expect.objectContaining({
        label: "MOCK",
        tags: ["token"],
        metadata: {
          label: {
            category: "token",
            entity: undefined,
            source: "normalized-event-asset",
            updatedAt: undefined,
          },
        },
      }),
    ]);
  });

  it("labels wallet nodes through a provider before analysis consumers read the graph", async () => {
    const provider = createStaticLabelProvider([
      {
        nodeKind: "wallet",
        chainId: 56,
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        label: "Example Exchange Hot Wallet",
        entity: "Example Exchange",
        category: "cex",
        tags: ["known_entity", "cex", "hot_wallet"],
      },
    ]);
    const graph: RelationshipGraph = {
      nodes: [
        {
          id: "wallet:56:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          kind: "wallet",
          address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          chainId: 56,
          tags: ["observed"],
        },
      ],
      edges: [],
    };
    const enricher = createLabelGraphEnricher({ providers: [provider] });
    const enriched = await enricher.enrich(graph, []);
    const node = enriched.nodes[0] as GraphNode;

    expect(node.label).toBe("Example Exchange Hot Wallet");
    expect(node.tags).toEqual(["observed", "known_entity", "cex", "hot_wallet"]);
    expect(node.metadata?.label).toEqual({
      entity: "Example Exchange",
      category: "cex",
      source: "static-label-registry",
      updatedAt: undefined,
    });
  });

  it("labels known BSC stablecoin contracts from the static registry", async () => {
    const graph: RelationshipGraph = {
      nodes: [
        {
          id: "contract:56:0x55d398326f99059ff775485246999027b3197955",
          kind: "contract",
          address: "0x55d398326f99059ff775485246999027b3197955",
          chainId: 56,
        },
      ],
      edges: [],
    };
    const enriched = await enrichGraphWithLabels(graph, [], [createStaticLabelProvider()]);

    expect(enriched.nodes[0]).toEqual(
      expect.objectContaining({
        label: "USDT",
        tags: expect.arrayContaining(["token", "stablecoin"]),
      }),
    );
  });

  it("maps Etherscan nametag metadata into node labels", async () => {
    const fetchMock = async () =>
      new Response(
        JSON.stringify({
          status: "1",
          message: "OK",
          result: [
            {
              address: "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa",
              nametag: "Example Exchange 1",
              labels: ["Example Exchange", "Exchange"],
              labels_slug: ["example-exchange", "exchange"],
              lastupdatedtimestamp: 1721899658,
            },
          ],
        }),
      );
    const provider = createEtherscanNametagProvider({
      apiKey: "test-key",
      fetchImpl: fetchMock,
      requestThrottleMs: 0,
    });
    const labels = await provider.findLabels({
      nodes: [
        {
          id: "wallet:1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          kind: "wallet",
          address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          chainId: 1,
        },
      ],
      events: [],
    });

    expect(labels).toEqual([
      expect.objectContaining({
        nodeKind: "wallet",
        chainId: 1,
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        label: "Example Exchange 1",
        entity: "Example Exchange",
        category: "cex",
        tags: ["known_entity", "example-exchange", "exchange"],
        source: "etherscan-nametag",
      }),
    ]);
  });

  it("keeps analysis usable when a live nametag provider rejects", async () => {
    const errors: string[] = [];
    const provider = createEtherscanNametagProvider({
      apiKey: "test-key",
      fetchImpl: async () =>
        new Response(JSON.stringify({ status: "0", message: "NOTOK", result: "PRO endpoint" })),
      requestThrottleMs: 0,
      onError: (error) => errors.push(error.message),
    });
    const labels = await provider.findLabels({
      nodes: [
        {
          id: "wallet:1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          kind: "wallet",
          address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          chainId: 1,
        },
      ],
      events: [],
    });

    expect(labels).toEqual([]);
    expect(errors[0]).toContain("Etherscan nametag request failed");
  });

  it("maps Chainbase address labels into node labels", async () => {
    const fetchMock = async () =>
      new Response(
        JSON.stringify({
          code: 0,
          message: "ok",
          data: {
            address: [
              {
                name_tag: "Example Exchange Hot Wallet",
                entity: "Example Exchange",
                category: "exchange",
                tags: ["hot wallet", "cex"],
              },
            ],
          },
        }),
      );
    const provider = createChainbaseLabelProvider({
      apiKey: "test-key",
      fetchImpl: fetchMock,
      requestThrottleMs: 0,
    });
    const labels = await provider.findLabels({
      nodes: [
        {
          id: "wallet:56:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          kind: "wallet",
          address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          chainId: 56,
        },
      ],
      events: [],
    });

    expect(labels).toEqual([
      expect.objectContaining({
        nodeKind: "wallet",
        chainId: 56,
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        label: "Example Exchange Hot Wallet",
        entity: "Example Exchange",
        category: "cex",
        tags: ["known_entity", "hot_wallet", "cex"],
        source: "chainbase-address-labels",
      }),
    ]);
  });

  it("treats empty Chainbase label data as a cache miss", async () => {
    const provider = createChainbaseLabelProvider({
      apiKey: "test-key",
      fetchImpl: async () => new Response(JSON.stringify({ code: 0, message: "ok", data: {} })),
      requestThrottleMs: 0,
    });
    const labels = await provider.findLabels({
      nodes: [
        {
          id: "wallet:56:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          kind: "wallet",
          address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          chainId: 56,
        },
      ],
      events: [],
    });

    expect(labels).toEqual([]);
  });

  it("ignores low-quality Chainbase unknown-only labels", async () => {
    const provider = createChainbaseLabelProvider({
      apiKey: "test-key",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            code: 0,
            message: "ok",
            data: {
              address: [
                {
                  category: "unknown",
                  tags: ["hot wallet"],
                },
              ],
            },
          }),
        ),
      requestThrottleMs: 0,
    });
    const labels = await provider.findLabels({
      nodes: [
        {
          id: "wallet:56:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          kind: "wallet",
          address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          chainId: 56,
        },
      ],
      events: [],
    });

    expect(labels).toEqual([]);
  });

  it("persists live labels through configured sinks", async () => {
    const savedLabels: NodeLabel[][] = [];
    const liveProvider = createStaticLabelProvider([
      {
        nodeKind: "wallet",
        chainId: 56,
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        label: "Example Exchange Hot Wallet",
      },
    ]);
    const provider = createPersistingLabelProvider({
      provider: liveProvider,
      sinks: [
        {
          id: "memory-sink",
          async saveLabels(labels) {
            savedLabels.push(labels);
          },
        },
      ],
    });

    await provider.findLabels({
      nodes: [
        {
          id: "wallet:56:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          kind: "wallet",
          address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          chainId: 56,
        },
      ],
      events: [],
    });

    expect(savedLabels[0]?.[0]?.label).toBe("Example Exchange Hot Wallet");
  });
});
