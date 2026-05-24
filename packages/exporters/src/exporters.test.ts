import { describe, expect, it } from "vitest";
import { JsonExporter, MarkdownExporter } from "./index";
import type { AnalysisReport } from "./index";

const report: AnalysisReport = {
  title: "Demo Report",
  generatedAt: "2024-01-01T00:00:00.000Z",
  graph: {
    nodes: [],
    edges: [],
  },
  findings: [
    {
      id: "finding-1",
      analyzerId: "direct-transfer",
      title: "Direct transfer found",
      description: "Wallets transferred value directly.",
      severity: "high",
      confidence: "high",
      scoreImpact: 40,
      evidence: [],
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

    expect(JSON.parse(output)).toMatchObject({ title: "Demo Report" });
  });

  it("exports Markdown reports", async () => {
    const output = await new MarkdownExporter().export(report);

    expect(output).toContain("# Demo Report");
    expect(output).toContain("Direct transfer found");
  });
});
