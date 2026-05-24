import { describe, expect, it } from "vitest";
import { JsonExporter, MarkdownExporter } from "./index";
import type { AnalysisReport } from "./index";

const report: AnalysisReport = {
  title: "Demo Report",
  generatedAt: "2024-01-01T00:00:00.000Z",
  graph: {
    nodes: [
      {
        id: "wallet:1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        kind: "wallet",
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        chainId: 1,
        tags: ["watched"],
      },
      {
        id: "wallet:1:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        kind: "wallet",
        address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        chainId: 1,
        tags: ["watched"],
      },
    ],
    edges: [
      {
        id: "native_transfer:1:0x1111111111111111111111111111111111111111111111111111111111111111:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        kind: "native_transfer",
        source: "wallet:1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        target: "wallet:1:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        weight: 1,
        evidenceEventIds: ["event-1"],
        metadata: {
          txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        },
      },
    ],
  },
  findings: [
    {
      id: "finding-1",
      analyzerId: "direct-transfer",
      title: "Direct transfer found",
      description:
        "Wallet 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa transferred value directly to 0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.",
      severity: "high",
      confidence: "high",
      scoreImpact: 40,
      evidence: [
        {
          eventId: "event-1",
          txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
          summary:
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa sent native value to 0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.",
        },
      ],
    },
  ],
  score: {
    score: 40,
    confidence: "high",
    reasons: ["Direct transfer found"],
    counterEvidence: [],
  },
};

describe("exporters", () => {
  it("exports JSON reports", async () => {
    const output = await new JsonExporter().export(report);

    expect(JSON.parse(output)).toMatchObject({
      schemaVersion: "1.0",
      title: "Demo Report",
    });
  });

  it("exports Markdown reports", async () => {
    const output = await new MarkdownExporter().export(report);

    expect(output).toContain("# Demo Report");
    expect(output).toContain("## Summary");
    expect(output).toContain("## Score");
    expect(output).toContain("## Graph Stats");
    expect(output).toContain("Direct transfer found");
    expect(output).toContain(
      "tx: 0x1111111111111111111111111111111111111111111111111111111111111111",
    );
    expect(output).toContain("## Cautionary Note");
  });

  it("redacts addresses in Markdown reports without redacting transaction hashes", async () => {
    const output = await new MarkdownExporter().export(report, { redactAddresses: true });

    expect(output).toContain("0xaaaa...aaaa");
    expect(output).toContain("0xbbbb...bbbb");
    expect(output).not.toContain("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(output).not.toContain("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    expect(output).toContain(
      "0x1111111111111111111111111111111111111111111111111111111111111111",
    );
  });

  it("redacts addresses in JSON reports", async () => {
    const output = await new JsonExporter().export(report, { redactAddresses: true });
    const parsed = JSON.parse(output);

    expect(parsed.graph.nodes[0].id).toBe("wallet:1:0xaaaa...aaaa");
    expect(parsed.graph.nodes[0].address).toBe("0xaaaa...aaaa");
    expect(parsed.graph.edges[0].source).toBe("wallet:1:0xaaaa...aaaa");
    expect(parsed.findings[0].description).toContain("0xaaaa...aaaa");
    expect(parsed.graph.edges[0].metadata.txHash).toBe(
      "0x1111111111111111111111111111111111111111111111111111111111111111",
    );
  });
});
