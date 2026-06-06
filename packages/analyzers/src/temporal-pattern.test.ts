import { buildRelationshipGraph } from "@wallet-map/core";
import type { Address, AnalysisContext, NormalizedEvent } from "@wallet-map/core";
import { describe, expect, it } from "vitest";
import { TemporalPatternAnalyzer } from "./index";

const watchedA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const watchedB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const observedC = "0xcccccccccccccccccccccccccccccccccccccccc";
const contractD = "0xdddddddddddddddddddddddddddddddddddddddd";
const tokenE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

function txHash(seed: string): string {
  return `0x${seed.repeat(64).slice(0, 64)}`;
}

describe("TemporalPatternAnalyzer", () => {
  it("finds watched wallets interacting with the same contract within the time window", async () => {
    const events: NormalizedEvent[] = [
      {
        id: "event:1",
        type: "contract_call",
        chainId: 1,
        txHash: txHash("1"),
        blockNumber: 1,
        timestamp: "2024-01-01T00:00:00.000Z",
        from: watchedA,
        contract: contractD,
        methodId: "0x095ea7b3",
      },
      {
        id: "event:2",
        type: "contract_call",
        chainId: 1,
        txHash: txHash("2"),
        blockNumber: 2,
        timestamp: "2024-01-01T00:05:00.000Z",
        from: watchedB,
        contract: contractD,
        methodId: "0x095ea7b3",
      },
    ];
    const context = buildContext(events, [watchedA, watchedB]);

    const findings = await new TemporalPatternAnalyzer().run(context);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toBe("Temporal pattern found");
    expect(findings[0]?.metadata).toMatchObject({
      patternType: "contract",
      contractNodeId: `contract:1:${contractD}`,
      watchedWalletNodeIds: [`wallet:1:${watchedA}`, `wallet:1:${watchedB}`],
      windowStart: "2024-01-01T00:00:00.000Z",
      windowEnd: "2024-01-01T00:05:00.000Z",
    });
    expect((findings[0]?.metadata as { edgeIds?: string[] } | undefined)?.edgeIds).toHaveLength(2);
  });

  it("does not report same-contract activity outside the time window", async () => {
    const events: NormalizedEvent[] = [
      {
        id: "event:1",
        type: "contract_call",
        chainId: 1,
        txHash: txHash("1"),
        blockNumber: 1,
        timestamp: "2024-01-01T00:00:00.000Z",
        from: watchedA,
        contract: contractD,
        methodId: "0x095ea7b3",
      },
      {
        id: "event:2",
        type: "contract_call",
        chainId: 1,
        txHash: txHash("2"),
        blockNumber: 2,
        timestamp: "2024-01-01T00:30:00.000Z",
        from: watchedB,
        contract: contractD,
        methodId: "0x095ea7b3",
      },
    ];
    const context = buildContext(events, [watchedA, watchedB]);

    await expect(new TemporalPatternAnalyzer().run(context)).resolves.toEqual([]);
  });

  it("finds same-counterparty transfer timing with the same asset", async () => {
    const events: NormalizedEvent[] = [
      {
        id: "event:1",
        type: "token_transfer",
        chainId: 1,
        txHash: txHash("1"),
        blockNumber: 1,
        timestamp: "2024-01-01T00:00:00.000Z",
        from: watchedA,
        to: observedC,
        contract: tokenE,
        asset: {
          kind: "erc20",
          chainId: 1,
          symbol: "USDC",
          contract: tokenE,
        },
        amount: "1000000",
      },
      {
        id: "event:2",
        type: "token_transfer",
        chainId: 1,
        txHash: txHash("2"),
        blockNumber: 2,
        timestamp: "2024-01-01T00:08:00.000Z",
        from: watchedB,
        to: observedC,
        contract: tokenE,
        asset: {
          kind: "erc20",
          chainId: 1,
          symbol: "USDC",
          contract: tokenE,
        },
        amount: "1000000",
      },
    ];
    const context = buildContext(events, [watchedA, watchedB]);

    const findings = await new TemporalPatternAnalyzer().run(context);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.confidence).toBe("medium");
    expect(findings[0]?.scoreImpact).toBe(15);
    expect(findings[0]?.metadata).toMatchObject({
      patternType: "counterparty",
      counterpartyNodeId: `wallet:1:${observedC}`,
      watchedWalletNodeIds: [`wallet:1:${watchedA}`, `wallet:1:${watchedB}`],
    });
  });

  it("requires distinct watched wallets", async () => {
    const events: NormalizedEvent[] = [
      {
        id: "event:1",
        type: "contract_call",
        chainId: 1,
        txHash: txHash("1"),
        blockNumber: 1,
        timestamp: "2024-01-01T00:00:00.000Z",
        from: watchedA,
        contract: contractD,
      },
      {
        id: "event:2",
        type: "contract_call",
        chainId: 1,
        txHash: txHash("2"),
        blockNumber: 2,
        timestamp: "2024-01-01T00:05:00.000Z",
        from: watchedA,
        contract: contractD,
      },
    ];
    const context = buildContext(events, [watchedA, watchedB]);

    await expect(new TemporalPatternAnalyzer().run(context)).resolves.toEqual([]);
  });

  it("skips invalid timestamps without reporting false positives", async () => {
    const events: NormalizedEvent[] = [
      {
        id: "event:1",
        type: "contract_call",
        chainId: 1,
        txHash: txHash("1"),
        blockNumber: 1,
        timestamp: "not-a-date",
        from: watchedA,
        contract: contractD,
      },
      {
        id: "event:2",
        type: "contract_call",
        chainId: 1,
        txHash: txHash("2"),
        blockNumber: 2,
        timestamp: "2024-01-01T00:05:00.000Z",
        from: watchedB,
        contract: contractD,
      },
    ];
    const context = buildContext(events, [watchedA, watchedB]);

    await expect(new TemporalPatternAnalyzer().run(context)).resolves.toEqual([]);
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
