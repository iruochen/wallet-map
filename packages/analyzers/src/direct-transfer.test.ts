import { describe, expect, it } from "vitest";
import { DirectTransferAnalyzer } from "./index";
import type { AnalysisContext } from "@wallet-map/core";

describe("DirectTransferAnalyzer", () => {
  it("finds transfer edges between watched wallets", async () => {
    const context: AnalysisContext = {
      graph: {
        nodes: [
          { id: "wallet:a", kind: "wallet" },
          { id: "wallet:b", kind: "wallet" },
        ],
        edges: [
          {
            id: "edge:1",
            kind: "native_transfer",
            source: "wallet:a",
            target: "wallet:b",
            weight: 1,
            evidenceEventIds: ["event:1"],
          },
        ],
      },
      events: [
        {
          id: "event:1",
          type: "native_transfer",
          chainId: 1,
          txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
          blockNumber: 1,
          timestamp: "2024-01-01T00:00:00.000Z",
        },
      ],
    };

    const findings = await new DirectTransferAnalyzer().run(context);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toBe("Direct transfer found");
    expect(findings[0]?.evidence[0]?.txHash).toBe(
      "0x1111111111111111111111111111111111111111111111111111111111111111",
    );
  });
});
