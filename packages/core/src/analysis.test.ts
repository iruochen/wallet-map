import { describe, expect, it } from "vitest";
import { runAnalysis } from "./analysis";
import type { Analyzer } from "./analysis";

describe("runAnalysis", () => {
  it("builds a graph, runs analyzers, and scores findings", async () => {
    const analyzer: Analyzer = {
      id: "test-analyzer",
      name: "Test Analyzer",
      async run(context) {
        return [
          {
            id: "finding:1",
            analyzerId: "test-analyzer",
            title: `${context.graph.edges.length} edge analyzed`,
            description: "Synthetic finding for analysis pipeline verification.",
            severity: "high",
            confidence: "high",
            scoreImpact: 40,
            evidence: [{ eventId: "event:1", summary: "Synthetic evidence" }],
          },
        ];
      },
    };

    const result = await runAnalysis({
      watchedAddresses: [
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      ],
      events: [
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
      ],
      analyzers: [analyzer],
    });

    expect(result.graph.edges).toHaveLength(1);
    expect(result.findings).toHaveLength(1);
    expect(result.score).toMatchObject({
      score: 40,
      confidence: "high",
    });
  });
});
