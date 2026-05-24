import type { Finding, RelationshipGraph, RelationshipScore } from "@wallet-map/core";

export interface ExportOptions {
  redactAddresses?: boolean;
}

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
  export(report: AnalysisReport, options?: ExportOptions): Promise<string>;
}

export class JsonExporter implements Exporter {
  id = "json";
  name = "JSON Exporter";

  async export(report: AnalysisReport, options: ExportOptions = {}): Promise<string> {
    return JSON.stringify(
      {
        schemaVersion: "1.0",
        ...redactReport(report, options),
      },
      null,
      2,
    );
  }
}

export class MarkdownExporter implements Exporter {
  id = "markdown";
  name = "Markdown Exporter";

  async export(report: AnalysisReport, options: ExportOptions = {}): Promise<string> {
    const safeReport = redactReport(report, options);
    const findings = formatFindings(safeReport.findings);

    return [
      `# ${safeReport.title}`,
      "",
      `Generated at: ${safeReport.generatedAt}`,
      "",
      "## Summary",
      `This report reviews ${safeReport.graph.nodes.length} graph nodes and ${safeReport.graph.edges.length} relationship edges for signs of wallet association.`,
      "",
      "## Score",
      `Score: ${safeReport.score.score}/100`,
      `Confidence: ${safeReport.score.confidence}`,
      formatList("Reasons", safeReport.score.reasons),
      formatList("Counter Evidence", safeReport.score.counterEvidence),
      "",
      "## Graph Stats",
      `- Nodes: ${safeReport.graph.nodes.length}`,
      `- Edges: ${safeReport.graph.edges.length}`,
      `- Wallet nodes: ${countNodesByKind(safeReport.graph, "wallet")}`,
      `- Contract nodes: ${countNodesByKind(safeReport.graph, "contract")}`,
      "",
      "## Findings",
      findings || "No findings.",
      "",
      "## Cautionary Note",
      "These results are analytical signals, not proof of common ownership or coordinated activity. Review the evidence, chain context, timing, and possible exchange, bridge, or contract-mediated flows before making decisions.",
      "",
    ].join("\n");
  }
}

function formatFindings(findings: Finding[]): string {
  return findings
    .map((finding) =>
      [
        `### ${finding.title}`,
        "",
        `- Severity: ${finding.severity}`,
        `- Confidence: ${finding.confidence}`,
        `- Score impact: ${finding.scoreImpact}`,
        `- Analyzer: ${finding.analyzerId}`,
        `- Description: ${finding.description}`,
        formatEvidence(finding),
      ].join("\n"),
    )
    .join("\n\n");
}

function formatEvidence(finding: Finding): string {
  if (finding.evidence.length === 0) {
    return "- Evidence: No transaction evidence attached.";
  }

  const lines = finding.evidence.map((evidence) => {
    const txHash = evidence.txHash ? `, tx: ${evidence.txHash}` : "";
    return `  - ${evidence.eventId}${txHash}: ${evidence.summary}`;
  });

  return ["- Evidence:", ...lines].join("\n");
}

function formatList(title: string, items: string[]): string {
  if (items.length === 0) {
    return `${title}: none`;
  }

  return [`${title}:`, ...items.map((item) => `- ${item}`)].join("\n");
}

function countNodesByKind(graph: RelationshipGraph, kind: string): number {
  return graph.nodes.filter((node) => node.kind === kind).length;
}

function redactReport(report: AnalysisReport, options: ExportOptions): AnalysisReport {
  if (!options.redactAddresses) {
    return report;
  }

  return redactValue(report) as AnalysisReport;
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactAddresses(value);
  }

  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, redactValue(entry)]),
    );
  }

  return value;
}

function redactAddresses(value: string): string {
  return value.replace(/\b0x[a-fA-F0-9]{40}\b/g, (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  });
}
