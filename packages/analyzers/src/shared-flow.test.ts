import { buildRelationshipGraph } from "@wallet-map/core";
import type { Address, AnalysisContext, NormalizedEvent } from "@wallet-map/core";
import { describe, expect, it } from "vitest";
import { SharedFundingSourceAnalyzer, SharedWithdrawalDestinationAnalyzer } from "./index";

const watchedA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const watchedB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const watchedC = "0xcccccccccccccccccccccccccccccccccccccccc";
const observedD = "0xdddddddddddddddddddddddddddddddddddddddd";
const observedE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const zeroAddress = "0x0000000000000000000000000000000000000000";

function transferEvent(id: string, from: string, to: string): NormalizedEvent {
  return {
    id: `event:${id}`,
    type: "native_transfer",
    chainId: 1,
    txHash: `0x${id.repeat(64).slice(0, 64)}`,
    blockNumber: Number(id),
    timestamp: `2024-01-01T00:${String(Number(id)).padStart(2, "0")}:00.000Z`,
    from,
    to,
    amount: "100",
  };
}

describe("SharedFundingSourceAnalyzer", () => {
  it("finds watched wallets funded by the same observed wallet", async () => {
    const context = buildContext(
      [
        transferEvent("1", observedD, watchedA),
        transferEvent("2", observedD, watchedB),
      ],
      [watchedA, watchedB],
    );

    const findings = await new SharedFundingSourceAnalyzer().run(context);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toBe("Shared funding source found");
    expect(findings[0]?.confidence).toBe("medium");
    expect(findings[0]?.scoreImpact).toBe(30);
    expect(findings[0]?.evidence).toHaveLength(2);
    expect(findings[0]?.metadata).toMatchObject({
      sourceNodeId: `wallet:1:${observedD}`,
      watchedWalletNodeIds: [`wallet:1:${watchedA}`, `wallet:1:${watchedB}`],
      direction: "funding",
    });
  });

  it("raises confidence when a source funds three watched wallets with repeated evidence", async () => {
    const context = buildContext(
      [
        transferEvent("1", observedD, watchedA),
        transferEvent("2", observedD, watchedA),
        transferEvent("3", observedD, watchedB),
        transferEvent("4", observedD, watchedB),
        transferEvent("5", observedD, watchedC),
        transferEvent("6", observedD, watchedC),
      ],
      [watchedA, watchedB, watchedC],
    );

    const findings = await new SharedFundingSourceAnalyzer().run(context);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.confidence).toBe("high");
    expect(findings[0]?.scoreImpact).toBe(36);
  });

  it("ignores outgoing shared destinations and zero-address funding", async () => {
    const context = buildContext(
      [
        transferEvent("1", watchedA, observedD),
        transferEvent("2", watchedB, observedD),
        transferEvent("3", zeroAddress, watchedA),
        transferEvent("4", zeroAddress, watchedB),
      ],
      [watchedA, watchedB],
    );

    await expect(new SharedFundingSourceAnalyzer().run(context)).resolves.toEqual([]);
  });
});

describe("SharedWithdrawalDestinationAnalyzer", () => {
  it("finds watched wallets sending to the same observed wallet", async () => {
    const context = buildContext(
      [
        transferEvent("1", watchedA, observedD),
        transferEvent("2", watchedB, observedD),
      ],
      [watchedA, watchedB],
    );

    const findings = await new SharedWithdrawalDestinationAnalyzer().run(context);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toBe("Shared withdrawal destination found");
    expect(findings[0]?.confidence).toBe("medium");
    expect(findings[0]?.scoreImpact).toBe(26);
    expect(findings[0]?.evidence).toHaveLength(2);
    expect(findings[0]?.metadata).toMatchObject({
      destinationNodeId: `wallet:1:${observedD}`,
      watchedWalletNodeIds: [`wallet:1:${watchedA}`, `wallet:1:${watchedB}`],
      direction: "withdrawal",
    });
  });

  it("does not report destinations touched by only one watched wallet", async () => {
    const context = buildContext(
      [
        transferEvent("1", watchedA, observedD),
        transferEvent("2", watchedB, observedE),
      ],
      [watchedA, watchedB],
    );

    await expect(new SharedWithdrawalDestinationAnalyzer().run(context)).resolves.toEqual([]);
  });

  it("ignores incoming shared sources and zero-address destinations", async () => {
    const context = buildContext(
      [
        transferEvent("1", observedD, watchedA),
        transferEvent("2", observedD, watchedB),
        transferEvent("3", watchedA, zeroAddress),
        transferEvent("4", watchedB, zeroAddress),
      ],
      [watchedA, watchedB],
    );

    await expect(new SharedWithdrawalDestinationAnalyzer().run(context)).resolves.toEqual([]);
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
