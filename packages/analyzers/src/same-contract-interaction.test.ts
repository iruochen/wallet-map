import { buildRelationshipGraph } from "@wallet-map/core";
import type { Address, AnalysisContext, NormalizedEvent } from "@wallet-map/core";
import { describe, expect, it } from "vitest";
import { SameContractInteractionAnalyzer } from "./index";

describe("SameContractInteractionAnalyzer", () => {
  it("finds contracts interacted with by two or more watched wallets", async () => {
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
        methodId: "0x095ea7b3",
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
        methodId: "0xa9059cbb",
      },
    ];
    const context = buildContext(events, [
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    ]);

    const findings = await new SameContractInteractionAnalyzer().run(context);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toBe("Same contract interaction found");
    expect(findings[0]?.confidence).toBe("low");
    expect(findings[0]?.scoreImpact).toBeLessThan(40);
    expect(findings[0]?.evidence).toHaveLength(2);
    expect(findings[0]?.metadata).toMatchObject({
      contractNodeId: "contract:1:0xcccccccccccccccccccccccccccccccccccccccc",
      watchedWalletNodeIds: [
        "wallet:1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "wallet:1:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      ],
    });
  });

  it("does not report contracts touched by only one watched wallet", async () => {
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
        contract: "0xdddddddddddddddddddddddddddddddddddddddd",
      },
    ];
    const context = buildContext(events, [
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    ]);

    await expect(new SameContractInteractionAnalyzer().run(context)).resolves.toEqual([]);
  });

  it("does not use transfer edges as contract interaction evidence", async () => {
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

    await expect(new SameContractInteractionAnalyzer().run(context)).resolves.toEqual([]);
  });

  it("downweights shared contract interactions with public token contracts", async () => {
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
    markNodeAsPublicEntity(context, "contract:1:0xcccccccccccccccccccccccccccccccccccccccc", "token");

    const findings = await new SameContractInteractionAnalyzer().run(context);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.confidence).toBe("low");
    expect(findings[0]?.scoreImpact).toBe(6);
    expect(findings[0]?.metadata).toMatchObject({
      publicEntity: true,
    });
  });
});

function buildContext(events: NormalizedEvent[], watchedAddresses: Address[]): AnalysisContext {
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
