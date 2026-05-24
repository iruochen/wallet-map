import type { Finding, RelationshipGraph, RelationshipScore } from "@wallet-map/core";

export interface AnalysisReport {
  title: string;
  generatedAt: string;
  graph: RelationshipGraph;
  findings: Finding[];
  score: RelationshipScore;
}

export interface Exporter {
  id: string;
  name: string;
  export(report: AnalysisReport): Promise<string>;
}

export class JsonExporter implements Exporter {
  id = "json";
  name = "JSON Exporter";

  async export(report: AnalysisReport): Promise<string> {
    return JSON.stringify(report, null, 2);
  }
}

export class MarkdownExporter implements Exporter {
  id = "markdown";
  name = "Markdown Exporter";

  async export(report: AnalysisReport): Promise<string> {
    const findings = report.findings
      .map((finding) => `- **${finding.title}** (${finding.confidence}): ${finding.description}`)
      .join("\n");

    return [
      `# ${report.title}`,
      "",
      `Generated at: ${report.generatedAt}`,
      "",
      `Score: ${report.score.score}/100 (${report.score.confidence})`,
      "",
      "## Findings",
      findings || "No findings.",
      "",
    ].join("\n");
  }
}
