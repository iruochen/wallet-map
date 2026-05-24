import { describe, expect, it } from "vitest";
import { DirectTransferAnalyzer } from "./index";
import { buildRelationshipGraph } from "@wallet-map/core";
import type { AnalysisContext, NormalizedEvent } from "@wallet-map/core";

describe("DirectTransferAnalyzer", () => {
  it("finds transfer edges between watched wallets", async () => {
    const events: NormalizedEvent[] = [
      {
        id: "event:1",
        type: "native_transfer",
        chainId: 1,
        txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        blockNumber: 1,
        timestamp: "2024-01-01T00:00:00.000Z",
        from: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        to: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
    ];
    const context: AnalysisContext = {
      graph: buildRelationshipGraph({
        watchedAddresses: [
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        ],
        events,
      }),
      events,
    };

    const findings = await new DirectTransferAnalyzer().run(context);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toBe("Direct transfer found");
    expect(findings[0]?.evidence[0]?.txHash).toBe(
      "0x1111111111111111111111111111111111111111111111111111111111111111",
    );
  });

  it("ignores transfer edges to observed external wallets", async () => {
    const events: NormalizedEvent[] = [
      {
        id: "event:1",
        type: "native_transfer",
        chainId: 1,
        txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        blockNumber: 1,
        timestamp: "2024-01-01T00:00:00.000Z",
        from: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        to: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
    ];
    const context: AnalysisContext = {
      graph: buildRelationshipGraph({
        watchedAddresses: ["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
        events,
      }),
      events,
    };

    await expect(new DirectTransferAnalyzer().run(context)).resolves.toEqual([]);
  });
});
