import { buildRelationshipGraph } from "@wallet-map/core";
import type { Address, AnalysisContext, NormalizedEvent } from "@wallet-map/core";
import { describe, expect, it } from "vitest";
import { MultiHopPathAnalyzer } from "./index";

const watchedA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const watchedB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const observedC = "0xcccccccccccccccccccccccccccccccccccccccc";
const observedD = "0xdddddddddddddddddddddddddddddddddddddddd";
const observedE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

function transferEvent(id: string, from: string, to: string, blockNumber: number): NormalizedEvent {
  return {
    id: `event:${id}`,
    type: "native_transfer",
    chainId: 1,
    txHash: `0x${id.repeat(64).slice(0, 64)}`,
    blockNumber,
    timestamp: `2024-01-01T00:${String(blockNumber).padStart(2, "0")}:00.000Z`,
    from,
    to,
    asset: {
      kind: "native",
      chainId: 1,
    },
    amount: "100",
  };
}

describe("MultiHopPathAnalyzer", () => {
  it("finds a two-hop transfer path between watched wallets", async () => {
    const context = buildContext(
      [transferEvent("1", watchedA, observedC, 1), transferEvent("2", observedC, watchedB, 2)],
      [watchedA, watchedB],
    );

    const findings = await new MultiHopPathAnalyzer().run(context);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toBe("Multi-hop transfer path found");
    expect(findings[0]?.confidence).toBe("medium");
    expect(findings[0]?.scoreImpact).toBeGreaterThanOrEqual(35);
    expect(findings[0]?.evidence).toHaveLength(2);
    expect(findings[0]?.metadata).toMatchObject({
      source: `wallet:1:${watchedA}`,
      target: `wallet:1:${watchedB}`,
      watchedWalletNodeIds: [`wallet:1:${watchedA}`, `wallet:1:${watchedB}`],
      pathLength: 2,
      intermediateNodeIds: [`wallet:1:${observedC}`],
    });
  });

  it("downweights transfer paths through labelled public entities", async () => {
    const context = buildContext(
      [transferEvent("1", watchedA, observedC, 1), transferEvent("2", observedC, watchedB, 2)],
      [watchedA, watchedB],
    );
    markNodeAsPublicEntity(context, `wallet:1:${observedC}`, "cex");

    const findings = await new MultiHopPathAnalyzer().run(context);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("low");
    expect(findings[0]?.confidence).toBe("low");
    expect(findings[0]?.scoreImpact).toBe(22);
    expect(findings[0]?.metadata).toMatchObject({
      publicEntityPath: true,
      publicIntermediateNodeIds: [`wallet:1:${observedC}`],
    });
  });

  it("finds a four-hop transfer path", async () => {
    const context = buildContext(
      [
        transferEvent("1", watchedA, observedC, 1),
        transferEvent("2", observedC, observedD, 2),
        transferEvent("3", observedD, observedE, 3),
        transferEvent("4", observedE, watchedB, 4),
      ],
      [watchedA, watchedB],
    );

    const findings = await new MultiHopPathAnalyzer().run(context);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.metadata).toMatchObject({
      pathLength: 4,
      watchedWalletNodeIds: [`wallet:1:${watchedA}`, `wallet:1:${watchedB}`],
    });
    expect(findings[0]?.evidence).toHaveLength(4);
  });

  it("ignores high-degree observed intermediaries", async () => {
    const extraObserved = Array.from({ length: 8 }, (_, index) =>
      `0x${String(index + 1).repeat(40).slice(0, 40)}`,
    );
    const events = [
      transferEvent("1", watchedA, observedC, 1),
      transferEvent("2", observedC, watchedB, 2),
      ...extraObserved.map((address, index) => transferEvent(String(index + 3), observedC, address, index + 3)),
    ];
    const context = buildContext(events, [watchedA, watchedB]);

    await expect(new MultiHopPathAnalyzer().run(context)).resolves.toEqual([]);
  });

  it("does not report paths without two watched endpoints", async () => {
    const context = buildContext(
      [transferEvent("1", watchedA, observedC, 1), transferEvent("2", observedC, observedD, 2)],
      [watchedA, watchedB],
    );

    await expect(new MultiHopPathAnalyzer().run(context)).resolves.toEqual([]);
  });

  it("avoids cyclic paths", async () => {
    const context = buildContext(
      [
        transferEvent("1", watchedA, observedC, 1),
        transferEvent("2", observedC, watchedA, 2),
      ],
      [watchedA, watchedB],
    );

    await expect(new MultiHopPathAnalyzer().run(context)).resolves.toEqual([]);
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
