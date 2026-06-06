import { buildRelationshipGraph } from "@wallet-map/core";
import type { Address, AnalysisContext, NormalizedEvent } from "@wallet-map/core";
import { describe, expect, it } from "vitest";
import { BridgeCorrelationAnalyzer } from "./index";

const watchedA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const watchedB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const watchedC = "0xcccccccccccccccccccccccccccccccccccccccc";
const bridgeContract = "0xdddddddddddddddddddddddddddddddddddddddd";
const token = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

function txHash(seed: string): string {
  return `0x${seed.repeat(64).slice(0, 64)}`;
}

function bridgeEvent(input: {
  id: string;
  from: string;
  timestamp: string;
  amount?: string;
  destinationChainId?: number;
  protocol?: string;
}): NormalizedEvent {
  return {
    id: `event:${input.id}`,
    type: "bridge",
    chainId: 1,
    txHash: txHash(input.id),
    blockNumber: Number(input.id),
    timestamp: input.timestamp,
    from: input.from,
    contract: bridgeContract,
    asset: {
      kind: "erc20",
      chainId: 1,
      symbol: "USDC",
      contract: token,
    },
    amount: input.amount ?? "1000000",
    metadata: {
      destinationChainId: input.destinationChainId,
      protocol: input.protocol ?? "LayerZero",
    },
  };
}

describe("BridgeCorrelationAnalyzer", () => {
  it("finds similar bridge routes within the bridge time window", async () => {
    const events = [
      bridgeEvent({
        id: "1",
        from: watchedA,
        timestamp: "2024-01-01T00:00:00.000Z",
        destinationChainId: 10,
      }),
      bridgeEvent({
        id: "2",
        from: watchedB,
        timestamp: "2024-01-01T00:20:00.000Z",
        destinationChainId: 10,
      }),
    ];
    const context = buildContext(events, [watchedA, watchedB]);

    const findings = await new BridgeCorrelationAnalyzer().run(context);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toBe("Bridge correlation found");
    expect(findings[0]?.confidence).toBe("medium");
    expect(findings[0]?.metadata).toMatchObject({
      watchedWalletNodeIds: [`wallet:1:${watchedA}`, `wallet:1:${watchedB}`],
      eventIds: ["event:1", "event:2"],
      windowStart: "2024-01-01T00:00:00.000Z",
      windowEnd: "2024-01-01T00:20:00.000Z",
      route: {
        sourceChainId: 1,
        destinationChainId: 10,
        protocol: "layerzero",
        contract: bridgeContract,
      },
      assetKey: `erc20:1:${token}`,
    });
  });

  it("raises score and confidence for similar amounts across three watched wallets", async () => {
    const events = [
      bridgeEvent({ id: "1", from: watchedA, timestamp: "2024-01-01T00:00:00.000Z", destinationChainId: 10, amount: "1000000" }),
      bridgeEvent({ id: "2", from: watchedB, timestamp: "2024-01-01T00:10:00.000Z", destinationChainId: 10, amount: "1005000" }),
      bridgeEvent({ id: "3", from: watchedC, timestamp: "2024-01-01T00:20:00.000Z", destinationChainId: 10, amount: "1009000" }),
    ];
    const context = buildContext(events, [watchedA, watchedB, watchedC]);

    const findings = await new BridgeCorrelationAnalyzer().run(context);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.confidence).toBe("high");
    expect(findings[0]?.scoreImpact).toBe(32);
    expect(findings[0]?.metadata).toMatchObject({
      similarAmounts: true,
      watchedWalletNodeIds: [`wallet:1:${watchedA}`, `wallet:1:${watchedB}`, `wallet:1:${watchedC}`],
    });
  });

  it("does not report bridge activity outside the bridge time window", async () => {
    const events = [
      bridgeEvent({
        id: "1",
        from: watchedA,
        timestamp: "2024-01-01T00:00:00.000Z",
        destinationChainId: 10,
      }),
      bridgeEvent({
        id: "2",
        from: watchedB,
        timestamp: "2024-01-01T01:00:00.000Z",
        destinationChainId: 10,
      }),
    ];
    const context = buildContext(events, [watchedA, watchedB]);

    await expect(new BridgeCorrelationAnalyzer().run(context)).resolves.toEqual([]);
  });

  it("requires at least two watched actors", async () => {
    const events = [
      bridgeEvent({
        id: "1",
        from: watchedA,
        timestamp: "2024-01-01T00:00:00.000Z",
        destinationChainId: 10,
      }),
      bridgeEvent({
        id: "2",
        from: watchedA,
        timestamp: "2024-01-01T00:10:00.000Z",
        destinationChainId: 10,
      }),
    ];
    const context = buildContext(events, [watchedA, watchedB]);

    await expect(new BridgeCorrelationAnalyzer().run(context)).resolves.toEqual([]);
  });

  it("handles unknown destinations conservatively", async () => {
    const events = [
      bridgeEvent({ id: "1", from: watchedA, timestamp: "2024-01-01T00:00:00.000Z", destinationChainId: undefined }),
      bridgeEvent({ id: "2", from: watchedB, timestamp: "2024-01-01T00:10:00.000Z", destinationChainId: undefined }),
    ];
    const context = buildContext(events, [watchedA, watchedB]);

    const findings = await new BridgeCorrelationAnalyzer().run(context);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.confidence).toBe("low");
    expect(findings[0]?.scoreImpact).toBeLessThan(25);
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
