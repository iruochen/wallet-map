import { buildRelationshipGraph } from "@wallet-map/core";
import type { Address, AnalysisContext, NormalizedEvent } from "@wallet-map/core";
import { describe, expect, it } from "vitest";
import { SharedCounterpartyAnalyzer } from "./index";

describe("SharedCounterpartyAnalyzer", () => {
  it("finds observed wallets that transfer with two or more watched wallets", async () => {
    const events: NormalizedEvent[] = [
      {
        id: "event:1",
        type: "native_transfer",
        chainId: 1,
        txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        blockNumber: 1,
        timestamp: "2024-01-01T00:00:00.000Z",
        from: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        to: "0xcccccccccccccccccccccccccccccccccccccccc",
      },
      {
        id: "event:2",
        type: "token_transfer",
        chainId: 1,
        txHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        blockNumber: 2,
        timestamp: "2024-01-01T00:01:00.000Z",
        from: "0xcccccccccccccccccccccccccccccccccccccccc",
        to: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
    ];
    const context = buildContext(events, [
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    ]);

    const findings = await new SharedCounterpartyAnalyzer().run(context);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toBe("Shared counterparty found");
    expect(findings[0]?.confidence).toBe("medium");
    expect(findings[0]?.scoreImpact).toBeLessThan(40);
    expect(findings[0]?.evidence).toHaveLength(2);
    expect(findings[0]?.metadata).toMatchObject({
      counterpartyNodeId: "wallet:1:0xcccccccccccccccccccccccccccccccccccccccc",
      watchedWalletNodeIds: [
        "wallet:1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "wallet:1:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      ],
    });
  });

  it("does not report a counterparty touched by only one watched wallet", async () => {
    const events: NormalizedEvent[] = [
      {
        id: "event:1",
        type: "native_transfer",
        chainId: 1,
        txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        blockNumber: 1,
        timestamp: "2024-01-01T00:00:00.000Z",
        from: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        to: "0xcccccccccccccccccccccccccccccccccccccccc",
      },
      {
        id: "event:2",
        type: "native_transfer",
        chainId: 1,
        txHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        blockNumber: 2,
        timestamp: "2024-01-01T00:01:00.000Z",
        from: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        to: "0xdddddddddddddddddddddddddddddddddddddddd",
      },
    ];
    const context = buildContext(events, [
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    ]);

    await expect(new SharedCounterpartyAnalyzer().run(context)).resolves.toEqual([]);
  });

  it("does not count shared contracts as wallet counterparties", async () => {
    const events: NormalizedEvent[] = [
      {
        id: "event:1",
        type: "contract_call",
        chainId: 1,
        txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        blockNumber: 1,
        timestamp: "2024-01-01T00:00:00.000Z",
        from: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        contract: "0xcccccccccccccccccccccccccccccccccccccccc",
      },
      {
        id: "event:2",
        type: "contract_call",
        chainId: 1,
        txHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        blockNumber: 2,
        timestamp: "2024-01-01T00:01:00.000Z",
        from: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        contract: "0xcccccccccccccccccccccccccccccccccccccccc",
      },
    ];
    const context = buildContext(events, [
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    ]);

    await expect(new SharedCounterpartyAnalyzer().run(context)).resolves.toEqual([]);
  });

  it("ignores zero-address mint activity as a shared counterparty", async () => {
    const events: NormalizedEvent[] = [
      {
        id: "event:1",
        type: "token_transfer",
        chainId: 1,
        txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        blockNumber: 1,
        timestamp: "2024-01-01T00:00:00.000Z",
        from: "0x0000000000000000000000000000000000000000",
        to: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      {
        id: "event:2",
        type: "token_transfer",
        chainId: 1,
        txHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        blockNumber: 2,
        timestamp: "2024-01-01T00:01:00.000Z",
        from: "0x0000000000000000000000000000000000000000",
        to: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
    ];
    const context = buildContext(events, [
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    ]);

    await expect(new SharedCounterpartyAnalyzer().run(context)).resolves.toEqual([]);
  });

  it("downweights shared counterparties labelled as public entities", async () => {
    const events: NormalizedEvent[] = [
      {
        id: "event:1",
        type: "native_transfer",
        chainId: 1,
        txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        blockNumber: 1,
        timestamp: "2024-01-01T00:00:00.000Z",
        from: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        to: "0xcccccccccccccccccccccccccccccccccccccccc",
      },
      {
        id: "event:2",
        type: "native_transfer",
        chainId: 1,
        txHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        blockNumber: 2,
        timestamp: "2024-01-01T00:01:00.000Z",
        from: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        to: "0xcccccccccccccccccccccccccccccccccccccccc",
      },
    ];
    const context = buildContext(events, [
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    ]);
    markNodeAsPublicEntity(context, "wallet:1:0xcccccccccccccccccccccccccccccccccccccccc", "cex");

    const findings = await new SharedCounterpartyAnalyzer().run(context);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("low");
    expect(findings[0]?.confidence).toBe("low");
    expect(findings[0]?.scoreImpact).toBe(8);
    expect(findings[0]?.metadata).toMatchObject({
      publicEntity: true,
    });
  });
});

function buildContext(
  events: NormalizedEvent[],
  watchedAddresses: Address[],
): AnalysisContext {
  return {
    graph: buildRelationshipGraph({
      watchedAddresses,
      events,
    }),
    events,
  };
}

function markNodeAsPublicEntity(context: AnalysisContext, nodeId: string, category: string): void {
  const node = context.graph.nodes.find((candidate) => candidate.id === nodeId);

  if (!node) {
    throw new Error(`Missing node ${nodeId}`);
  }

  node.tags = [...(node.tags ?? []), "known_entity", category];
  node.metadata = {
    ...node.metadata,
    label: {
      category,
      source: "test",
    },
  };
}
